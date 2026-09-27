import type { BlockDefinition } from "@/contexts/cms";

// Vídeo/mapa/áudio de serviço externo por URL. Só provedores conhecidos viram iframe
// (embed-providers.ts) — nunca um iframe de URL arbitrária colada pelo editor.
export const embedBlockDefinition: BlockDefinition = {
  key: "core.content.embed",
  label: "Vídeo / incorporação",
  category: "mídia",
  structure: "leaf",
  allowedInRoot: false,
  defaultData: { url: "", title: "", aspect: "video" },
  requiredDataFields: ["url"],
  missingConfigMessage: "Cole o link do YouTube, Vimeo, Google Maps ou Spotify",
  editorFields: [
    { name: "url", type: "url", label: "Link (YouTube, Vimeo, Google Maps, Spotify)" },
    { name: "title", type: "text", label: "Título (acessibilidade)" },
    {
      name: "aspect",
      type: "select",
      label: "Proporção",
      options: [
        { value: "video", label: "16:9" },
        { value: "square", label: "Quadrado" },
        { value: "portrait", label: "Vertical (9:16)" },
      ],
    },
  ],
};
