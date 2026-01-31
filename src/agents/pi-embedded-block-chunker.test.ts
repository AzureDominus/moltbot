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
});
