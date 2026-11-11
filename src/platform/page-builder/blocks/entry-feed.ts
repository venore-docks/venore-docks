import type { BlockDefinition } from "@/contexts/cms";

export const ENTRY_FEED_BLOCK_KEY = "core.content.entry-feed";

// Últimas publicações de uma categoria (ex.: Notícias na home) — lista DINÂMICA: o card aparece
// sozinho quando a entry é publicada, sem editar a página. Visibilidade por entry respeitada
// (visitante sem sessão só vê "public"). Renderer: entry-feed/entry-feed-block.tsx.
export const entryFeedBlockDefinition: BlockDefinition = {
  key: ENTRY_FEED_BLOCK_KEY,
  label: "Publicações recentes",
  category: "conteúdo",
  structure: "leaf",
  allowedInRoot: true,
  defaultData: { title: "Novidades", categorySlug: "noticias", limit: 3, viewAllLabel: "Ver todas as notícias" },
  requiredDataFields: ["categorySlug"],
  missingConfigMessage: "Informe a categoria (slug) das publicações",
  editorFields: [
    { name: "title", type: "text", label: "Título (opcional)" },
    { name: "categorySlug", type: "text", label: "Categoria (slug da rota, ex.: noticias)" },
    { name: "limit", type: "number", label: "Quantidade de publicações (1 a 12)" },
    { name: "viewAllLabel", type: "text", label: 'Texto do link "Ver todas" (vazio = sem link)' },
  ],
};
