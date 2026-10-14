// Fatia do barrel de contexts/themes para a config de tema v8 (spec §11). Reexportada por
// contexts/themes/index.ts. Dono: W6. Escrita/rascunho/histórico exigem settings.manage (spec
// §4.4); a validação contra o registro de temas mora em platform/theme-engine/theme-config.ts —
// actions chamam o composer, não estas funções direto.
export { getPublishedThemeConfigHandler as getPublishedThemeConfig } from "./get-published-theme-config/handler";
export { getThemeConfigRevisionHandler as getThemeConfigRevision } from "./get-theme-config-revision/handler";
export { getThemeDraftHandler as getThemeDraft } from "./get-theme-draft/handler";
export { saveThemeDraftHandler as saveThemeDraft } from "./save-theme-draft/handler";
export { discardThemeDraftHandler as discardThemeDraft } from "./discard-theme-draft/handler";
export { publishThemeDraftHandler as publishThemeDraft } from "./publish-theme-draft/handler";
export { listThemeConfigHistoryHandler as listThemeConfigHistory } from "./list-theme-config-history/handler";
export { rollbackThemeConfigHandler as rollbackThemeConfig } from "./rollback-theme-config/handler";
export { exportThemeConfigHandler as exportThemeConfig } from "./export-theme-config/handler";
export { importThemeConfigHandler as importThemeConfig } from "./import-theme-config/handler";
export { isReservedSectionPrefix, RESERVED_SECTION_SEGMENTS } from "./shared/section-rules";

export type { GetPublishedThemeConfigResult } from "./get-published-theme-config/types";
export type { GetThemeConfigRevisionInput, GetThemeConfigRevisionResult } from "./get-theme-config-revision/types";
export type { GetThemeDraftResult } from "./get-theme-draft/types";
export type { SaveThemeDraftInput, SaveThemeDraftResult } from "./save-theme-draft/types";
export type { DiscardThemeDraftResult } from "./discard-theme-draft/types";
export type { PublishThemeDraftResult } from "./publish-theme-draft/types";
export type { ThemeConfigHistoryPage, ListThemeConfigHistoryResult } from "./list-theme-config-history/types";
export type { RollbackThemeConfigInput, RollbackThemeConfigResult } from "./rollback-theme-config/types";
export type { ExportThemeConfigInput, ExportThemeConfigResult } from "./export-theme-config/types";
export type { ImportThemeConfigInput, ImportThemeConfigResult, ImportThemeConfigOperationResult } from "./import-theme-config/types";
export { THEME_CONFIG_STORAGE_UNAVAILABLE } from "./shared/storage-errors";
