import type { Block } from "@/contexts/cms";

function textFromRichTextNode(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const record = node as { type?: unknown; text?: unknown; content?: unknown };
  if (record.type === "text" && typeof record.text === "string") return record.text;
  if (Array.isArray(record.content)) return record.content.map(textFromRichTextNode).join(" ");
  return "";
}

// Entries não têm campo de resumo dedicado (só corpo estruturado em blocos) — deriva um preview
// em texto puro do primeiro bloco de rich text da composição. Usado pelo blogroll, pela
// description das páginas e pelo RSS.
export function extractExcerpt(composition: Block[] | null, maxLength = 160): string | null {
  if (!composition) return null;

  function walk(blocks: Block[]): string | null {
    for (const block of blocks) {
      if (block.key === "core.content.richtext") {
        const content = (block.data as { content?: unknown }).content;
        if (content && typeof content === "object") {
          const text = textFromRichTextNode(content).replace(/\s+/g, " ").trim();
          if (text) return text;
        }
      }
      for (const area of block.areas ?? []) {
        const found = walk(area.blocks);
        if (found) return found;
      }
    }
    return null;
  }

  const text = walk(composition);
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}
