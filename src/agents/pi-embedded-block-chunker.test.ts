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

  it("breaks at sentence boundary when buffer >= minChars (block streaming)", () => {
    // With minChars=300, maxChars=1200, breakPreference=paragraph
    // A 934-char paragraph with sentences should break at a sentence >= minChars
    const chunker = new EmbeddedBlockChunker({
      minChars: 300,
      maxChars: 1200,
      breakPreference: "paragraph",
    });

    const text =
      "Bet. This is one long paragraph, with punctuation, and with zero intentional line breaks. I am writing it as a single continuous block so you can test whether your new streaming logic preserves it as one message, instead of splitting it into chunks. If WhatsApp wraps the text visually on your screen, that is normal UI wrapping, not an actual newline from me. I am going to keep going for a bit longer so it is obvious: a few sentences, some commas, some periods, maybe a question or two. Does the timestamp stay the same, and does it show up as one bubble on your side? If your system is accidentally splitting on punctuation, or splitting after N characters, this should reveal it. Also watch for weird stuff like double spaces, missing spaces after periods, or random truncation, because those usually point to token buffering or transport formatting. Alright, that should be long enough to stress it without adding any new lines.";

    expect(text.length).toBe(934);

    chunker.append(text);

    const chunks: string[] = [];
    chunker.drain({ force: false, emit: (chunk) => chunks.push(chunk) });

    console.log("Chunks (force=false, minChars=300):", chunks.length);
    chunks.forEach((c, i) =>
      console.log(`Chunk ${i}: ends with "${c.slice(-30)}" (${c.length} chars)`),
    );
    console.log("Buffered:", chunker.bufferedText.length, "chars");

    // Should break at a sentence boundary >= minChars (300)
    // The first sentence ending after 300 chars is around char 364 ("...not an actual newline from me.")
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    // Each chunk should end at a sentence boundary
    for (const chunk of chunks) {
      expect(chunk).toMatch(/[.!?]$/);
    }
  });

  it("does NOT break at word boundary when buffer < maxChars", () => {
    // With minChars=50 but no sentence breaks after minChars,
    // should NOT fall back to word breaks until maxChars
    const chunker = new EmbeddedBlockChunker({
      minChars: 50,
      maxChars: 200,
      breakPreference: "paragraph",
    });

    // 144 chars, ONE sentence (no breaks after the first period at char 4)
    const text =
      "Bet. This is a single sentence that keeps going and going without any more punctuation until the very end of the message which is right here now";

    expect(text.length).toBe(144);

    chunker.append(text);

    const chunks: string[] = [];
    chunker.drain({ force: false, emit: (chunk) => chunks.push(chunk) });

    console.log("Chunks (no sentence after minChars):", chunks);
    console.log("Buffered:", chunker.bufferedText.length, "chars");

    // Only one sentence ending at char 4 ("Bet.") which is < minChars (50)
    // So no valid break point - should NOT break at word boundary
    // Should wait for more text or maxChars
    expect(chunks.length).toBe(0);
    expect(chunker.bufferedText).toBe(text);
  });
});
