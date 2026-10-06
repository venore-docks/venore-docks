import type { Block } from "./block";
import { getEntryBody, getEntryComposition } from "./entry-body";

// Texto corrido de uma entry, para leitura em voz alta: título e o texto dos blocos de conteúdo
// na ordem em que aparecem (título de seção, rich text, markdown, citação, lista). Imagem,
// botão, embed e afins não têm o que ler. Parágrafos separados por linha em branco.

const BLOCK_NODE_TYPES = new Set(["paragraph", "heading", "blockquote", "listItem", "codeBlock", "tableRow"]);

function richTextToPlain(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const record = node as { type?: unknown; text?: unknown; content?: unknown };
  if (record.type === "text" && typeof record.text === "string") return record.text;
  if (record.type === "hardBreak") return "\n";
  if (!Array.isArray(record.content)) return "";
  const children = record.content.map(richTextToPlain);
  const isContainer = record.content.some(
    (child) => child && typeof child === "object" && BLOCK_NODE_TYPES.has(String((child as { type?: unknown }).type)),
  );
  return children.join(isContainer ? "\n\n" : "");
}

// Markdown -> texto falado: tira marcação, mantém o texto de links, descarta imagens e código.
export function markdownToPlain(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[ \t]{0,3}(#{1,6}|>|[-*+]|\d+[.)])[ \t]+/gm, "")
    .replace(/^[ \t]*\|?[ \t]*:?-{3,}.*$/gm, "")
    .replace(/\|/g, " ")
    .replace(/(\*\*|__|\*|_|~~|`)/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function textValue(value: unknown): string {
  if (typeof value === "string") return value;
  return richTextToPlain(value);
}

function blockText(block: Block): string {
  const data = block.data ?? {};
  switch (block.key) {
    case "core.content.heading":
      return textValue(data.text);
    case "core.content.richtext":
      return data.content && typeof data.content === "object"
        ? richTextToPlain(data.content)
        : markdownToPlain(typeof data.markdown === "string" ? data.markdown : "");
    case "core.content.markdown":
      return markdownToPlain(typeof data.source === "string" ? data.source : "");
    case "core.content.quote":
      return [textValue(data.text), typeof data.author === "string" ? data.author : ""].filter(Boolean).join("\n\n");
    case "core.content.list":
      return typeof data.items === "string" ? data.items.split("\n").map((line) => line.trim()).filter(Boolean).join(".\n") : "";
    default:
      return "";
  }
}

function compositionText(blocks: Block[]): string[] {
  return blocks.flatMap((block) => [blockText(block), ...block.areas.flatMap((area) => compositionText(area.blocks))]);
}

export function extractEntryPlainText(title: string, data: unknown): string {
  const composition = getEntryComposition(data);
  const body = composition ? compositionText(composition) : [markdownToPlain(getEntryBody(data))];
  return [title, ...body]
    .map((part) => part.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim())
    .filter(Boolean)
    .join("\n\n");
}
