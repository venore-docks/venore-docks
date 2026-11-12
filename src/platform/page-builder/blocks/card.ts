import type { BlockDefinition } from "@/contexts/cms";

export const CARD_BLOCK_KEY = "core.content.card";

export const cardBlockDefinition: BlockDefinition = {
  key: CARD_BLOCK_KEY,
  label: "Card",
  category: "conteúdo",
  structure: "leaf",
  allowedInRoot: false,
  defaultData: { mediaId: null, title: "", description: "", href: "", buttonLabel: "", tone: "default" },
  requiredDataFields: ["title"],
  missingConfigMessage: "Sem título definido",
  editorFields: [
    { name: "mediaId", type: "image", label: "Imagem (opcional)" },
    { name: "title", type: "text", label: "Título" },
    { name: "description", type: "richtext", label: "Descrição" },
    { name: "href", type: "url", label: "Link (opcional)" },
    { name: "buttonLabel", type: "text", label: "Texto do botão (opcional)" },
    {
      name: "tone",
      type: "select",
      label: "Cor do card",
      options: [
        { value: "default", label: "Padrão" },
        { value: "sidebar", label: "Igual à barra lateral" },
        { value: "primary", label: "Primária" },
        { value: "secondary", label: "Secundária" },
        { value: "accent", label: "Destaque" },
        { value: "warning", label: "Laranja (aviso)" },
        { value: "success", label: "Verde (sucesso)" },
        { value: "destructive", label: "Vermelha" },
      ],
    },
  ],
};
