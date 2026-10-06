import { speechPort, type SpeechPortKind } from "@/infrastructure/speech";
import type { OperationResult } from "@/shared/types";
import type { SpeechClipStatus } from "../../contracts/types";
import { currentUsageMonth } from "../../shared/language";
import { readSpeechSettings, type SpeechSettings } from "../../shared/speech-settings";
import { countClipsByStatus, getUsage } from "../../shared/store";

export type SpeechStatus = SpeechSettings & {
  // Driver ativo (SPEECH_DRIVER): "worker" (GitHub Actions), "inline" (Google) ou "disabled".
  mode: SpeechPortKind;
  configured: boolean;
  month: string;
  usedCharacters: number;
  clips: Record<SpeechClipStatus, number>;
};

// Painel de /admin/settings. Quem chama já checou settings.manage (a página e a action).
export async function getSpeechStatus(): Promise<OperationResult<SpeechStatus>> {
  const month = currentUsageMonth();
  const [settings, usedCharacters, clips] = await Promise.all([readSpeechSettings(), getUsage(month), countClipsByStatus()]);
  return { success: true, data: { ...settings, mode: speechPort.kind, configured: speechPort.isEnabled(), month, usedCharacters, clips } };
}
