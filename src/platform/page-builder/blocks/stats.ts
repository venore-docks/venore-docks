import type { BlockDefinition } from "@/contexts/cms";

export const statsBlockDefinition: BlockDefinition = {
  key: "core.content.stats",
  label: "Números em destaque",
  category: "conteúdo",
  structure: "leaf",
  allowedInRoot: false,
  defaultData: { items: "1.200 | alunos\n98% | aprovação\n15 | anos", columns: "3" },
  requiredDataFields: ["items"],
  missingConfigMessage: "Nenhum número cadastrado",
  editorFields: [
    { name: "items", type: "textarea", label: "Itens (um por linha: valor | rótulo)" },
    {
      name: "columns",
      type: "select",
      label: "Colunas no desktop",
      options: [
        { value: "2", label: "2" },
        { value: "3", label: "3" },
        { value: "4", label: "4" },
      ],
    },
  ],
};
