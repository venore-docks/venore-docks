import type { ReactNode } from "react";
import Markdown from "react-markdown";
import { renderToReactElement } from "@tiptap/static-renderer";
import type { JSONContent } from "@tiptap/core";
import { cn } from "@/lib/utils";
import { createRichTextExtensions } from "./extensions";

// Fonte única pra QUALQUER campo editorFields do tipo "richtext" — não só o bloco Rich Text
// (core.content.richtext). Alert.description, Card.description, Quote.text, Birthdays
// description/emptyMessage etc. todos guardam o mesmo formato (JSON do Tiptap, produzido por
// RichTextField) e renderizam por aqui, com fallback pra string (campos que ainda guardam o
// valor legado de antes da troca pra Tiptap).

// Classes que todo consumidor de renderRichTextContent precisa aplicar no wrapper — sem elas,
// <ol>/<ul>/<blockquote> do Tiptap saem sem marcador/indentação (reset do Tailwind Preflight
// zera list-style por padrão). Menor que o RICHTEXT_CLASSES do bloco principal (h1/h2/h3 grandes
// não cabem dentro de um Alert/Card/badge de aviso) — pensado pra descrição inline, não conteúdo
// de página inteira.
export const RICH_TEXT_INLINE_CLASSES = cn(
  "space-y-2 text-current",
  "[&_a]:text-primary [&_a]:underline",
  "[&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold",
  "[&_p]:leading-relaxed",
  "[&_ul]:list-disc [&_ul]:ps-5 [&_ol]:list-decimal [&_ol]:ps-5 [&_li]:leading-relaxed",
  "[&_blockquote]:border-s-2 [&_blockquote]:border-current/30 [&_blockquote]:ps-3 [&_blockquote]:opacity-80",
);

export function hasRichTextContent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

export function renderRichTextContent(value: unknown): ReactNode {
  if (typeof value === "string") {
    // react-markdown nunca renderiza HTML cru do markdown de origem (sem dangerouslySetInnerHTML,
    // sem rehype-raw) — segue a mesma garantia de sanitização de antes.
    return <Markdown>{value}</Markdown>;
  }
  if (value && typeof value === "object") {
    // renderToReactElement usa as mesmas extensões do editor (RichTextField) pra converter o JSON
    // direto em elementos React — nunca gera string HTML, então não existe caminho de XSS.
    return renderToReactElement({ content: value as JSONContent, extensions: createRichTextExtensions() });
  }
  return null;
}
