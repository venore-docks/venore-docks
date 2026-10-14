import type { OperationResult } from "@/shared/types";
import type { ThemeConfigExportEnvelope } from "../../../contracts/v8/config-document";

// `themeVersion` vem do registro de temas (packageVersion), que contexts não importa — o composer
// de platform informa. Sem ele, o envelope leva "0.0.0".
export type ExportThemeConfigInput = { themeVersion?: string };
export type ExportThemeConfigCommand = ExportThemeConfigInput & { actorId: string };
export type ExportThemeConfigResult = OperationResult<ThemeConfigExportEnvelope>;
