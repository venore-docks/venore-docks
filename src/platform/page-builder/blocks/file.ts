import type { BlockDefinition } from "@/contexts/cms";

// Link de download de um arquivo da biblioteca de mídia (PDF, planilha...). Campo `mediaId`, mesma
// convenção dos outros blocos de mídia (export/import e "onde a mídia é usada" já cobrem).
export const fileBlockDefinition: BlockDefinition = {
  key: "core.content.file",
  label: "Arquivo para download",
  category: "mídia",
  structure: "leaf",
  allowedInRoot: false,
  defaultData: { mediaId: null, label: "", description: "" },
  requiredDataFields: ["mediaId"],
  missingConfigMessage: "Nenhum arquivo selecionado",
  editorFields: [
    { name: "mediaId", type: "file", label: "Arquivo" },
    { name: "label", type: "text", label: "Texto do link (padrão: nome do arquivo)" },
    { name: "description", type: "text", label: "Descrição (opcional)" },
  ],
};
