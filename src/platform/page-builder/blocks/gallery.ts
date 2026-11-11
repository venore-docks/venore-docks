import type { BlockDefinition } from "@/contexts/cms";
import { IMAGE_BLOCK_KEY } from "./image";

export const GALLERY_BLOCK_KEY = "core.layout.gallery";

// Mesmo padrão de card-grid.ts: areas com allowedBlockKeys fixo em um único bloco filho (aqui,
// Imagem) — reaproveita toda a mecânica de adicionar/remover/reordenar filhos já existente no
// builder, sem precisar de um EditorFieldType novo pra "lista de mídia".
export const galleryBlockDefinition: BlockDefinition = {
  key: GALLERY_BLOCK_KEY,
  label: "Galeria",
  category: "estrutura",
  structure: "areas",
  allowedInRoot: true,
  defaultData: { columns: 3, gap: "md", variant: "grid", lightbox: false, aspect: "auto" },
  editorFields: [
    {
      name: "columns",
      type: "select",
      label: "Colunas",
      options: [
        { value: "2", label: "2" },
        { value: "3", label: "3" },
        { value: "4", label: "4" },
      ],
    },
    {
      name: "gap",
      type: "select",
      label: "Espaçamento",
      options: [
        { value: "sm", label: "Pequeno" },
        { value: "md", label: "Médio" },
        { value: "lg", label: "Grande" },
      ],
    },
    {
      name: "variant",
      type: "select",
      label: "Estilo",
      options: [
        { value: "grid", label: "Grade simples" },
        { value: "mural", label: "Mural (cartões com sombra e hover)" },
      ],
    },
    { name: "lightbox", type: "boolean", label: "Ampliar a imagem ao clicar (lightbox)" },
    {
      name: "aspect",
      type: "select",
      label: "Proporção dos cartões (mural)",
      options: [
        { value: "auto", label: "Original" },
        { value: "10-9", label: "10:9" },
        { value: "4-3", label: "4:3" },
        { value: "1-1", label: "Quadrado" },
      ],
    },
  ],
  areaDefinitions: [{ key: "items", label: "Imagens", allowedBlockKeys: [IMAGE_BLOCK_KEY] }],
};
