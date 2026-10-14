import type { OperationResult } from "@/shared/types";
import type { ThemeConfigRevisionView } from "../../../contracts/v8/config-document";

export type GetThemeConfigRevisionInput = { revisionId: string };
// data null = revisão inexistente. Erro themes.config.storage_unavailable = tabela ausente (42P01).
export type GetThemeConfigRevisionResult = OperationResult<ThemeConfigRevisionView | null>;
