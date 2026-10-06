import { describe, expect, it } from "vitest";
import { extractEntryPlainText, markdownToPlain } from "./entry-text";

const block = (key: string, data: Record<string, unknown>, areas: unknown[] = []) => ({ id: key, key, slot: "main", htmlId: null, data, areas });

describe("extractEntryPlainText", () => {
  it("junta título e blocos de texto em ordem, inclusive dentro de áreas, e ignora o resto", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Primeiro " }, { type: "text", marks: [{ type: "bold" }], text: "parágrafo" }] },
        { type: "paragraph", content: [{ type: "text", text: "Segundo." }] },
      ],
    };
    const data = {
      blocks: [
        block("core.content.heading", { text: "Seção" }),
        block("core.content.image", { mediaId: "x", alt: "foto" }),
        block("core.layout.row", {}, [{ key: "col", blocks: [block("core.content.richtext", { content: doc })] }]),
        block("core.content.quote", { text: "Frase", author: "Autora" }),
      ],
    };
    expect(extractEntryPlainText("Título", data)).toBe("Título\n\nSeção\n\nPrimeiro parágrafo\n\nSegundo.\n\nFrase\n\nAutora");
  });

  it("entry antiga com data.body em texto", () => {
    expect(extractEntryPlainText("T", { body: "Corpo **forte**." })).toBe("T\n\nCorpo forte.");
  });
});

describe("markdownToPlain", () => {
  it("mantém texto de link, tira imagem, código e marcação", () => {
    expect(markdownToPlain("# Oi\n\nVeja [o site](https://x.y) ![img](a.png)\n\n```js\ncode\n```\n- item *um*")).toBe(
      "Oi\n\nVeja o site\n\nitem um",
    );
  });
});
