import type { BlockDefinition } from "@/contexts/cms";

export const tableBlockDefinition: BlockDefinition = {
  key: "core.content.table",
  label: "Tabela",
  category: "conteúdo",
  structure: "leaf",
  allowedInRoot: false,
  defaultData: { rows: "Coluna 1 | Coluna 2\nValor | Valor", header: true, caption: "" },
  requiredDataFields: ["rows"],
  missingConfigMessage: "Tabela vazia",
  editorFields: [
    { name: "rows", type: "textarea", label: "Linhas (uma por linha, células separadas por |)" },
    { name: "header", type: "boolean", label: "Primeira linha é cabeçalho" },
    { name: "caption", type: "text", label: "Legenda (opcional)" },
  ],
};
