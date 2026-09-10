import { describe, expect, it } from "vitest";
import { extractFirstParagraphText } from "./excerpt";

function richtextEntryData(richtextData: Record<string, unknown>) {
  return {
    blocks: [{ id: "block-1", key: "core.content.richtext", slot: "main", data: richtextData, areas: [] }],
  };
}

describe("extractFirstParagraphText", () => {
  it("returns null for an entry with no body at all", () => {
    expect(extractFirstParagraphText({})).toBeNull();
  });

  it("extracts the first non-empty paragraph from a Tiptap composition", () => {
    const data = richtextEntryData({
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [] },
          { type: "paragraph", content: [{ type: "text", text: "Primeiro parágrafo de verdade." }] },
          { type: "paragraph", content: [{ type: "text", text: "Segundo parágrafo, nunca usado." }] },
        ],
      },
    });

    expect(extractFirstParagraphText(data)).toBe("Primeiro parágrafo de verdade.");
  });

  it("concatenates text across marks (bold/italic) inside the same paragraph", () => {
    const data = richtextEntryData({
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Texto " },
              { type: "text", text: "em negrito", marks: [{ type: "bold" }] },
              { type: "text", text: " continua aqui." },
            ],
          },
        ],
      },
    });

    expect(extractFirstParagraphText(data)).toBe("Texto em negrito continua aqui.");
  });

  it("truncates long text at a word boundary with an ellipsis", () => {
    const longText = "palavra ".repeat(60).trim();
    const data = richtextEntryData({ content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: longText }] }] } });

    const result = extractFirstParagraphText(data);
    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(241);
    expect(result!.endsWith("…")).toBe(true);
    expect(result!.endsWith(" …")).toBe(false);
  });

  it("falls back to data.markdown when the richtext block has no content doc", () => {
    const data = richtextEntryData({ markdown: "Primeira linha.\nSegunda linha." });
    expect(extractFirstParagraphText(data)).toBe("Primeira linha.");
  });

  it("returns null when the richtext block has neither content nor markdown", () => {
    const data = richtextEntryData({});
    expect(extractFirstParagraphText(data)).toBeNull();
  });

  it("falls back to the legacy plain-text body when there is no composition", () => {
    expect(extractFirstParagraphText({ body: "Corpo legado sem blocos." })).toBe("Corpo legado sem blocos.");
  });
});
