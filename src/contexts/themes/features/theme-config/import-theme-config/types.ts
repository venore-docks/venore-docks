import type { OperationResult } from "@/shared/types";
import type { ThemeConfigExportEnvelope, ThemeConfigRevisionView } from "../../../contracts/v8/config-document";

// `warnings`: o que o composer de platform já descartou ao validar contra o registro local
// (opção desconhecida, tema ausente…) — vai junto na auditoria e volta pro admin.
export type ImportThemeConfigInput = { envelope: unknown; warnings?: string[] };
export type ImportThemeConfigCommand = { envelope: ThemeConfigExportEnvelope; warnings: string[]; actorId: string };
// Nome herdado da assinatura da Fase F: `ImportThemeConfigResult` é o dado; o envelope de
// OperationResult é `ImportThemeConfigOperationResult`.
export type ImportThemeConfigResult = { draft: ThemeConfigRevisionView; warnings: string[] };
export type ImportThemeConfigOperationResult = OperationResult<ImportThemeConfigResult>;
