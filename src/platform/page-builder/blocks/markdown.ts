import type { BlockDefinition } from "@/contexts/cms";

// Conteúdo em Markdown (GFM: tabelas, listas de tarefa, tachado, links automáticos) — pra quem
// escreve documentação/artigo em Markdown em vez do editor visual (core.content.richtext). HTML
// cru dentro do Markdown NÃO é renderizado (react-markdown sem rehype-raw) e URLs `javascript:`
// são neutralizadas pelo urlTransform padrão — ver MarkdownBlock em block-renderers.tsx.
export const markdownBlockDefinition: BlockDefinition = {
  key: "core.content.markdown",
  label: "Markdown",
  category: "conteúdo",
  structure: "leaf",
  allowedInRoot: false,
  defaultData: { source: "" },
  requiredDataFields: ["source"],
  missingConfigMessage: "Nenhum conteúdo em Markdown",
  editorFields: [{ name: "source", type: "textarea", label: "Conteúdo em Markdown" }],
};
