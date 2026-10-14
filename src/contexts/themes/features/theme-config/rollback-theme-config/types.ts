import type { OperationResult } from "@/shared/types";
import type { ThemeConfigRevisionView } from "../../../contracts/v8/config-document";

export type RollbackThemeConfigInput = { revisionId: string };
export type RollbackThemeConfigCommand = RollbackThemeConfigInput & { actorId: string };
// A revisão NOVA publicada (rollback nunca reaproveita a linha antiga).
export type RollbackThemeConfigResult = OperationResult<ThemeConfigRevisionView>;
