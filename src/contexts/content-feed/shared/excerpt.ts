// getEntryComposition, no barrel do cms, é outra coisa (getEntryCompositionHandler, um handler
// assíncrono de DB) — a função pura de contracts/entry-body.ts é reexportada como
// extractEntryComposition especificamente pra evitar essa colisão de nome.
import { extractEntryComposition, getEntryBody } from "@/contexts/cms";
import type { Block, Composition } from "@/contexts/cms";

// Recorta ~240 caracteres numa fronteira de palavra — nunca corta uma palavra no meio, o "..." só
// entra quando de fato truncou.
const EXCERPT_MAX_LENGTH = 240;
function truncateAtWordBoundary(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= EXCERPT_MAX_LENGTH) return trimmed;
  const cut = trimmed.slice(0, EXCERPT_MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

// Nó do doc ProseMirror/Tiptap — shape solto de propósito (o schema real vive no editor, aqui só
// precisamos ler texto, não validar). content.ts (bloco core.content.richtext) guarda o doc
// inteiro em block.data.content.
type ProseMirrorNode = { type?: string; text?: string; content?: ProseMirrorNode[] };

// Concatena todo texto de dentro de um nó (recursivo — marks como negrito/itálico não mudam a
// estrutura, só envolvem o mesmo nó "text").
function collectText(node: ProseMirrorNode): string {
  if (typeof node.text === "string") return node.text;
  if (!Array.isArray(node.content)) return "";
  return node.content.map(collectText).join("");
}

// Primeiro nó "paragraph" do doc com texto de verdade (pula parágrafo vazio, comum logo após um
// heading no editor).
function firstParagraphText(doc: unknown): string | null {
  if (!doc || typeof doc !== "object" || !Array.isArray((doc as ProseMirrorNode).content)) return null;
  for (const node of (doc as ProseMirrorNode).content ?? []) {
    if (node.type !== "paragraph") continue;
    const text = collectText(node).trim();
    if (text) return text;
  }
  return null;
}

// Acha o primeiro bloco de um tipo específico na composição, olhando também dentro de áreas
// aninhadas (ex: uma seção com um richtext dentro) — mesma travessia que qualquer renderer de
// composição já faz, só que parando no primeiro match em vez de renderizar tudo.
function findFirstBlockByKey(blocks: Composition, key: string): Block | null {
  for (const block of blocks) {
    if (block.key === key) return block;
    for (const area of block.areas) {
      const found = findFirstBlockByKey(area.blocks, key);
      if (found) return found;
    }
  }
  return null;
}

const RICHTEXT_BLOCK_KEY = "core.content.richtext";

// Resumo pro feed federado (pedido explícito: "quero... mostrando... primeiro parágrafo") — nunca
// lança nem exige que a entry tenha um shape específico: entry sem corpo nenhum (só título) devolve
// null, o card no assinante degrada sem parágrafo em vez de quebrar.
export function extractFirstParagraphText(data: unknown): string | null {
  const composition = extractEntryComposition(data);
  if (composition) {
    const richtextBlock = findFirstBlockByKey(composition, RICHTEXT_BLOCK_KEY);
    const content = richtextBlock?.data?.content;
    if (content) {
      const text = firstParagraphText(content);
      if (text) return truncateAtWordBoundary(text);
    }
    // data.markdown é o fallback legado só de DENTRO do bloco richtext (antes do editor migrar
    // pra Tiptap) — string crua, sem parser de markdown aqui, só a primeira linha não vazia.
    const markdown = richtextBlock?.data?.markdown;
    if (typeof markdown === "string" && markdown.trim()) {
      const firstLine = markdown.split("\n").find((line) => line.trim().length > 0);
      if (firstLine) return truncateAtWordBoundary(firstLine);
    }
    return null;
  }

  // Entry pré-composição (nunca migrada pro modelo de blocos) — corpo é data.body, texto solto.
  const legacyBody = getEntryBody(data);
  return legacyBody.trim() ? truncateAtWordBoundary(legacyBody) : null;
}
