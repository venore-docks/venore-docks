// Lado publicador — "quem pode ler daqui".
export { createConnectionHandler as createConnection } from "./features/publisher/create-connection/handler";
export { listConnectionsHandler as listConnections } from "./features/publisher/list-connections/handler";
export { deleteConnectionHandler as deleteConnection } from "./features/publisher/delete-connection/handler";
export {
  updateConnectionCategoriesHandler as updateConnectionCategories,
} from "./features/publisher/update-connection-categories/handler";
// Consumida pela rota pública src/app/api/content-feed/articles/route.ts — acesso por chave, não
// por sessão (ver comentário no próprio handler).
export {
  listArticlesForConnectionHandler as listArticlesForConnection,
} from "./features/publisher/list-articles-for-connection/handler";

// Lado assinante — "de onde eu leio".
export { createSourceHandler as createSource } from "./features/subscriber/create-source/handler";
export { listSourcesHandler as listSources } from "./features/subscriber/list-sources/handler";
export { deleteSourceHandler as deleteSource } from "./features/subscriber/delete-source/handler";
export { updateSourceHandler as updateSource } from "./features/subscriber/update-source/handler";
export { syncSourceHandler as syncSource } from "./features/subscriber/sync-source/handler";

// Leitura pública do cache local — pro consumo futuro por outros contexts/plugins (Broadcast etc.).
export { listArticlesHandler as listArticles } from "./features/list-articles/handler";

export { contentFeedAdminNavigationItems } from "./admin-navigation";

export type {
  ContentFeedConnectionRecord,
  ContentFeedSourceRecord,
  ContentFeedArticleRecord,
  ContentFeedApiArticle,
  ContentFeedApiResponse,
} from "./contracts/types";

export type { CreateConnectionInput, CreateConnectionResult } from "./features/publisher/create-connection/types";
export type { ListConnectionsResult } from "./features/publisher/list-connections/types";
export type { DeleteConnectionInput, DeleteConnectionResult } from "./features/publisher/delete-connection/types";
export type {
  UpdateConnectionCategoriesInput,
  UpdateConnectionCategoriesResult,
} from "./features/publisher/update-connection-categories/types";
export type {
  ListArticlesForConnectionQuery,
  ListArticlesForConnectionResult,
} from "./features/publisher/list-articles-for-connection/types";

export type { CreateSourceInput, CreateSourceResult } from "./features/subscriber/create-source/types";
export type { ListSourcesResult, SourceView } from "./features/subscriber/list-sources/types";
export type { DeleteSourceInput, DeleteSourceResult } from "./features/subscriber/delete-source/types";
export type { UpdateSourceInput, UpdateSourceResult } from "./features/subscriber/update-source/types";
export type { SyncSourceInput, SyncSourceResult } from "./features/subscriber/sync-source/types";

export type { ListArticlesQuery, ListArticlesResult, ContentFeedArticleView } from "./features/list-articles/types";
