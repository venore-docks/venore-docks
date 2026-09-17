import type { BlockDefinition } from "@/contexts/cms";

export const IMAGE_BLOCK_KEY = "core.content.image";

export const imageBlockDefinition: BlockDefinition = {
  key: IMAGE_BLOCK_KEY,
  label: "Imagem",
  category: "conteúdo",
  structure: "leaf",
  allowedInRoot: false,
  defaultData: { mediaId: null, alt: "", width: "full", caption: "" },
  requiredDataFields: ["mediaId"],
  missingConfigMessage: "Nenhuma mídia selecionada",
  editorFields: [
    { name: "mediaId", type: "image", label: "Mídia" },
    { name: "alt", type: "text", label: "Texto alternativo" },
    {
      name: "width",
      type: "select",
      label: "Largura",
      options: [
        { value: "full", label: "Largura total" },
        { value: "medium", label: "Média" },
        { value: "small", label: "Pequena" },
      ],
    },
    { name: "caption", type: "text", label: "Legenda" },
  ],
};
