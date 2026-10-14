import type { OperationResult } from "@/shared/types";
import type { ThemeConfigDocument, ThemeConfigRevisionView } from "../../../contracts/v8/config-document";

export type SaveThemeDraftInput = { config: ThemeConfigDocument; basedOnRevisionId?: string | null; note?: string | null };
export type SaveThemeDraftCommand = SaveThemeDraftInput & { actorId: string };
export type SaveThemeDraftResult = OperationResult<ThemeConfigRevisionView>;
