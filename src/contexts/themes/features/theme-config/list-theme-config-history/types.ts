import type { OperationResult } from "@/shared/types";
import type { ThemeConfigRevisionView } from "../../../contracts/v8/config-document";

// Publicada atual + arquivadas, mais nova primeiro, até THEME_CONFIG_HISTORY_LIMIT.
export type ThemeConfigHistoryPage = { items: ThemeConfigRevisionView[] };
export type ListThemeConfigHistoryResult = OperationResult<ThemeConfigHistoryPage>;
