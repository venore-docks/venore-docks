// Fatia do barrel de contexts/themes para a config de tema v8 (spec §11). Reexportada por
// contexts/themes/index.ts. Dono: W6 (a Fase F só define get-published e get-revision de verdade;
// o resto são as assinaturas finais em lifecycle-stubs.ts).
export { getPublishedThemeConfigHandler as getPublishedThemeConfig } from "./get-published-theme-config/handler";
export { getThemeConfigRevisionHandler as getThemeConfigRevision } from "./get-theme-config-revision/handler";
export type { GetPublishedThemeConfigResult } from "./get-published-theme-config/types";
export type { GetThemeConfigRevisionInput, GetThemeConfigRevisionResult } from "./get-theme-config-revision/types";
export {
  getThemeDraft,
  saveThemeDraft,
  discardThemeDraft,
  publishThemeDraft,
  listThemeConfigHistory,
  rollbackThemeConfig,
  exportThemeConfig,
  importThemeConfig,
} from "./lifecycle-stubs";
export type { SaveThemeDraftInput, ThemeConfigHistoryPage, ImportThemeConfigResult } from "./lifecycle-stubs";
export { THEME_CONFIG_STORAGE_UNAVAILABLE } from "./shared/storage-errors";
