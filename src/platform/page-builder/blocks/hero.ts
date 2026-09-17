import type { BlockDefinition } from "@/contexts/cms";

export const HERO_BLOCK_KEY = "core.content.hero";

// Leaf (não areas): dois CTAs de largura fixa, não uma lista arbitrária de blocos — montar isso
// com Button aninhado exigiria a mesma UI de builder que Section+Row+Button já cobre; Hero existe
// pra evitar montar esse combo à mão toda vez.
export const heroBlockDefinition: BlockDefinition = {
  key: HERO_BLOCK_KEY,
  label: "Hero",
  category: "conteúdo",
  structure: "leaf",
  allowedInRoot: true,
  defaultData: {
    eyebrow: "",
    title: "",
    subtitle: "",
    mediaId: null,
    align: "start",
    overlay: "none",
    primaryLabel: "",
    primaryHref: "",
    secondaryLabel: "",
    secondaryHref: "",
  },
  requiredDataFields: ["title"],
  missingConfigMessage: "Sem título definido",
  editorFields: [
    { name: "eyebrow", type: "text", label: "Texto de apoio (opcional)" },
    { name: "title", type: "text", label: "Título" },
    { name: "subtitle", type: "textarea", label: "Subtítulo (opcional)" },
    { name: "mediaId", type: "image", label: "Imagem de fundo (opcional)" },
    {
      name: "align",
      type: "select",
      label: "Alinhamento",
      options: [
        { value: "start", label: "Esquerda" },
        { value: "center", label: "Centro" },
      ],
    },
    {
      name: "overlay",
      type: "select",
      label: "Sobreposição sobre a imagem",
      options: [
        { value: "none", label: "Nenhuma" },
        { value: "dark", label: "Escura" },
        { value: "gradient", label: "Gradiente" },
      ],
    },
    { name: "primaryLabel", type: "text", label: "Botão principal — texto (opcional)" },
    { name: "primaryHref", type: "url", label: "Botão principal — link" },
    { name: "secondaryLabel", type: "text", label: "Botão secundário — texto (opcional)" },
    { name: "secondaryHref", type: "url", label: "Botão secundário — link" },
  ],
};
