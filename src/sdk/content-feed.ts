// Exposição MÍNIMA e read-only pra plugins — Broadcast Studio é o primeiro consumidor (troca da
// fonte de notícias externa pelo feed sincronizado de outras plataformas Venore Docks, decisão do
// usuário: "nenhum conteúdo da internet pode tocar nas TVs, com exceção do conteúdo que vai vir
// via o blog de outras plataformas Venore Docks"). Só a leitura do cache local já sincronizado
// (listArticles) — CRUD de conexões/fontes (quem publica, de onde um site assina) continua
// exclusivo do admin do host, em @/contexts/content-feed, nunca exposto por aqui.
export { listArticles } from "@/contexts/content-feed";
export type { ListArticlesQuery, ListArticlesResult, ContentFeedArticleView } from "@/contexts/content-feed";
