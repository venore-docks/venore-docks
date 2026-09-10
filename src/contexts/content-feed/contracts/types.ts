// Lado publicador — "quem pode ler daqui" (ver database/schema/index.ts). categoryIds resolve por
// join com content_feed_connection_categories, não é uma coluna própria.
export type ContentFeedConnectionRecord = {
  id: string;
  name: string;
  key: string;
  categoryIds: string[];
  createdAt: Date;
  lastUsedAt: Date | null;
};

// Lado assinante — "de onde eu leio". categoryKeys idem, resolve por join com
// content_feed_source_categories.
export type ContentFeedSourceRecord = {
  id: string;
  name: string;
  remoteUrl: string;
  connectionKey: string;
  categoryKeys: string[];
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
  createdAt: Date;
};

// Artigo já sincronizado (cache local). readMoreUrl não é uma coluna — monta-se em runtime a
// partir de source.remoteUrl + categorySlug + entrySlug (ver features/list-articles/service.ts).
export type ContentFeedArticleRecord = {
  id: string;
  sourceId: string;
  remoteRef: string;
  title: string;
  excerptText: string | null;
  coverImageUrl: string | null;
  categoryKey: string;
  entrySlug: string;
  categorySlug: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
  fetchedAt: Date;
};

// Forma que a rota GET /api/content-feed/articles devolve pro assinante — deliberadamente plana
// (nunca expõe o shape interno de composição de blocos do CMS, isola o assinante de detalhes de
// implementação do publicador). "ref" é o id da entry no publicador (vira remoteRef no assinante).
export type ContentFeedApiArticle = {
  ref: string;
  title: string;
  excerptText: string | null;
  coverImageUrl: string | null;
  categoryKey: string;
  entrySlug: string;
  categorySlug: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

export type ContentFeedApiResponse = { articles: ContentFeedApiArticle[] };
