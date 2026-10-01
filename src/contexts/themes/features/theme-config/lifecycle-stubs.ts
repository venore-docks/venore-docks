import type { OperationResult } from "@/shared/types";
import type {
  ThemeConfigDocument,
  ThemeConfigExportEnvelope,
  ThemeConfigRevisionView,
} from "../../contracts/v8/config-document";

// Assinaturas finais do ciclo de vida da config de tema (spec §7.2/§7.10). Dono: W6, que troca
// cada stub por um use case de verdade (handler/service/store/types em
// features/theme-config/<use-case>/) e apaga este arquivo. Até lá, o comportamento padrão é
// "rascunho indisponível" — nada é gravado. W2/W1 chamam estas assinaturas e mockam nos testes.
const unavailable = <T>(): OperationResult<T> => ({
  success: false,
  error: { code: "themes.config.lifecycle_unavailable", message: "Rascunho de tema ainda não disponível nesta versão." },
});

export type SaveThemeDraftInput = { config: ThemeConfigDocument; basedOnRevisionId?: string | null; note?: string | null };
export type ThemeConfigHistoryPage = { items: ThemeConfigRevisionView[] };
export type ImportThemeConfigResult = { draft: ThemeConfigRevisionView; warnings: string[] };

export async function getThemeDraft(): Promise<OperationResult<ThemeConfigRevisionView | null>> {
  return { success: true, data: null };
}
export async function saveThemeDraft(input: SaveThemeDraftInput): Promise<OperationResult<ThemeConfigRevisionView>> {
  void input;
  return unavailable();
}
export async function discardThemeDraft(): Promise<OperationResult<{ discarded: boolean }>> {
  return { success: true, data: { discarded: false } };
}
export async function publishThemeDraft(): Promise<OperationResult<ThemeConfigRevisionView>> {
  return unavailable();
}
export async function listThemeConfigHistory(): Promise<OperationResult<ThemeConfigHistoryPage>> {
  return { success: true, data: { items: [] } };
}
export async function rollbackThemeConfig(input: { revisionId: string }): Promise<OperationResult<ThemeConfigRevisionView>> {
  void input;
  return unavailable();
}
export async function exportThemeConfig(): Promise<OperationResult<ThemeConfigExportEnvelope>> {
  return unavailable();
}
export async function importThemeConfig(input: { envelope: unknown }): Promise<OperationResult<ImportThemeConfigResult>> {
  void input;
  return unavailable();
}
