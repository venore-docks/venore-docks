import type { OperationResult } from "@/shared/types";
import type { PublishedThemeConfig } from "../../../contracts/v8/config-document";

// Falha só quando NENHUM degrau respondeu (settings ilegível e sem last-known-good no processo) —
// quem renderiza cai então no documento padrão do slime (diagnóstico "config-read-failed").
export type GetPublishedThemeConfigResult = OperationResult<PublishedThemeConfig>;
