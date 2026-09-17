import type { BlockDefinition } from "@/contexts/cms";

export const CTA_BLOCK_KEY = "core.content.cta";

export const ctaBlockDefinition: BlockDefinition = {
  key: CTA_BLOCK_KEY,
  label: "CTA",
  category: "conteúdo",
  structure: "leaf",
  allowedInRoot: true,
  defaultData: { title: "", description: "", buttonLabel: "", buttonHref: "", background: "muted" },
  requiredDataFields: ["title", "buttonLabel", "buttonHref"],
  missingConfigMessage: "Faltam título, texto do botão ou link do botão",
  editorFields: [
    { name: "title", type: "text", label: "Título" },
    { name: "description", type: "textarea", label: "Descrição (opcional)" },
    { name: "buttonLabel", type: "text", label: "Texto do botão" },
    { name: "buttonHref", type: "url", label: "Link do botão" },
    {
      name: "background",
      type: "select",
      label: "Fundo",
      options: [
        { value: "muted", label: "Suave" },
        { value: "primary", label: "Destaque (marca)" },
        { value: "panel", label: "Painel" },
      ],
    },
  ],
};
