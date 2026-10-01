import type { BlockDefinition } from "@/contexts/cms";

export const timelineBlockDefinition: BlockDefinition = {
  key: "core.content.timeline",
  label: "Linha do tempo",
  category: "conteúdo",
  structure: "leaf",
  allowedInRoot: false,
  defaultData: { items: "2020 | Fundação | Como tudo começou\n2024 | Expansão | Novas unidades" },
  requiredDataFields: ["items"],
  missingConfigMessage: "Nenhum marco cadastrado",
  editorFields: [{ name: "items", type: "textarea", label: "Marcos (um por linha: data | título | descrição)" }],
};
