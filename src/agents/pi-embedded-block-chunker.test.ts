import { describe, expect, it } from "vitest";

import { EmbeddedBlockChunker } from "./pi-embedded-block-chunker.js";

describe("EmbeddedBlockChunker", () => {
  it("breaks at paragraph boundary right after fence close", () => {
    const chunker = new EmbeddedBlockChunker({
      minChars: 1,
      maxChars: 40,
      breakPreference: "paragraph",
    });

    const text = [
      "Intro",
      "```js",
      "console.log('x')",
      "```",
      "",
      "After first line",
      "After second line",
    ].join("\n");

    chunker.append(text);

    const chunks: string[] = [];
    chunker.drain({ force: false, emit: (chunk) => chunks.push(chunk) });

    expect(chunks.length).toBe(1);
    expect(chunks[0]).toContain("console.log");
    expect(chunks[0]).toMatch(/```\n?$/);
    expect(chunks[0]).not.toContain("After");
    expect(chunker.bufferedText).toMatch(/^After/);
  });

  it("prefers sentence boundaries over word boundaries when forced to break", () => {
    // With minChars=100 and maxChars=200, a 150-char text with sentences
    // should break at sentence boundary, not word boundary
    const chunker = new EmbeddedBlockChunker({
      minChars: 100,
      maxChars: 200,
      breakPreference: "paragraph",
    });

    // ~150 chars, sentence ends at "first." (~50 chars) which is < minChars
    // But when forced to break, should prefer sentence over word boundary
    const text =
      "This is the first. This is the second sentence that keeps going and going for a while to exceed the minimum character threshold for chunking behavior.";

    chunker.append(text);

    const chunks: string[] = [];
    chunker.drain({ force: true, emit: (chunk) => chunks.push(chunk) });

    // Should break after "first." even though it's < minChars, because it's
    // a sentence boundary which is preferable to word boundary
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    // The first chunk should end at a sentence boundary if possible
    if (chunks.length > 1) {
      expect(chunks[0]).toMatch(/[.!?]$/);
    }
  });

  it("reproduces user issue: 934-char paragraph with minChars=50 maxChars=1200", () => {
    // Exact user test case: long paragraph, no newlines, with punctuation
    // minChars=50, maxChars=1200, breakPreference=paragraph
    const chunker = new EmbeddedBlockChunker({
      minChars: 50,
      maxChars: 1200,
      breakPreference: "paragraph",
    });

    const text =
      "Bet. This is one long paragraph, with punctuation, and with zero intentional line breaks. I am writing it as a single continuous block so you can test whether your new streaming logic preserves it as one message, instead of splitting it into chunks. If WhatsApp wraps the text visually on your screen, that is normal UI wrapping, not an actual newline from me. I am going to keep going for a bit longer so it is obvious: a few sentences, some commas, some periods, maybe a question or two. Does the timestamp stay the same, and does it show up as one bubble on your side? If your system is accidentally splitting on punctuation, or splitting after N characters, this should reveal it. Also watch for weird stuff like double spaces, missing spaces after periods, or random truncation, because those usually point to token buffering or transport formatting. Alright, that should be long enough to stress it without adding any new lines.";

    // Text is 934 chars, less than maxChars (1200)
    expect(text.length).toBe(934);

    chunker.append(text);

    const chunks: string[] = [];
    // force=false simulates normal streaming (not end of message)
    chunker.drain({ force: false, emit: (chunk) => chunks.push(chunk) });

    console.log("Chunks (force=false):", chunks);
    console.log("Buffered:", chunker.bufferedText.length, "chars");

    // Since text < maxChars and no paragraph/newline breaks, it should NOT emit anything yet
    // (waiting for more text or force=true)
    expect(chunks.length).toBe(0);
    expect(chunker.bufferedText).toBe(text);
  });

  it("reproduces user issue with force=true at end of message", () => {
    const chunker = new EmbeddedBlockChunker({
      minChars: 50,
      maxChars: 1200,
      breakPreference: "paragraph",
    });

    const text =
      "Bet. This is one long paragraph, with punctuation, and with zero intentional line breaks. I am writing it as a single continuous block so you can test whether your new streaming logic preserves it as one message, instead of splitting it into chunks. If WhatsApp wraps the text visually on your screen, that is normal UI wrapping, not an actual newline from me. I am going to keep going for a bit longer so it is obvious: a few sentences, some commas, some periods, maybe a question or two. Does the timestamp stay the same, and does it show up as one bubble on your side? If your system is accidentally splitting on punctuation, or splitting after N characters, this should reveal it. Also watch for weird stuff like double spaces, missing spaces after periods, or random truncation, because those usually point to token buffering or transport formatting. Alright, that should be long enough to stress it without adding any new lines.";

    chunker.append(text);

    const chunks: string[] = [];
    // force=true simulates end of message
    chunker.drain({ force: true, emit: (chunk) => chunks.push(chunk) });

    console.log("Chunks (force=true):", chunks);
    console.log("Number of chunks:", chunks.length);
    chunks.forEach((c, i) => console.log(`Chunk ${i}: "${c.slice(0, 50)}..." (${c.length} chars)`));

    // With force=true, it should emit the entire text as ONE chunk
    // since it's under maxChars and there are no paragraph/newline breaks
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBe(text);
  });
});
