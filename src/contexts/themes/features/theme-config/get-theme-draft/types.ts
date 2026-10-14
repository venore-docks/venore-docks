import type { OperationResult } from "@/shared/types";
import type { ThemeConfigRevisionView } from "../../../contracts/v8/config-document";

// data null = não há rascunho (o admin edita a partir do publicado).
export type GetThemeDraftResult = OperationResult<ThemeConfigRevisionView | null>;
