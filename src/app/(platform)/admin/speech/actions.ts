"use server";

import { revalidatePath } from "next/cache";
import { authorizeActor } from "@/contexts/rbac";
import { setSetting } from "@/contexts/settings";
import {
  isSpeechVoice,
  requestSpeechWorkerRun,
  retryFailedSpeech,
  MAX_MONTHLY_CHARACTER_LIMIT,
  SPEECH_ENABLED_SETTING_KEY,
  SPEECH_MONTHLY_LIMIT_SETTING_KEY,
  SPEECH_VOICE_SETTING_KEY,
} from "@/contexts/speech";

export type SpeechSettingsActionState = { error: string | null };

// Leitura em voz alta (docs/speech/leitura-em-voz-alta.md). settings.manage é checado aqui (antes
// de ler o formulário) e de novo por setSetting.
export async function updateSpeechSettingsAction(
  _prevState: SpeechSettingsActionState,
  formData: FormData,
): Promise<SpeechSettingsActionState> {
  const authz = await authorizeActor("settings.manage");
  if (!authz.authorized) return { error: authz.error.message };

  const voice = String(formData.get("voice") ?? "");
  if (!isSpeechVoice(voice)) return { error: "Escolha uma das vozes da lista." };

  const rawLimit = String(formData.get("monthlyCharacterLimit") ?? "").replace(/[.\s]/g, "");
  const limit = Number(rawLimit);
  if (!rawLimit || !Number.isInteger(limit) || limit < 0 || limit > MAX_MONTHLY_CHARACTER_LIMIT) {
    return { error: `O teto mensal precisa ser um número inteiro entre 0 e ${MAX_MONTHLY_CHARACTER_LIMIT.toLocaleString("pt-BR")}.` };
  }

  const writes: { key: string; value: unknown }[] = [
    { key: SPEECH_ENABLED_SETTING_KEY, value: formData.get("enabled") === "on" },
    { key: SPEECH_VOICE_SETTING_KEY, value: voice },
    { key: SPEECH_MONTHLY_LIMIT_SETTING_KEY, value: limit },
  ];
  for (const write of writes) {
    const result = await setSetting(write);
    if (!result.success) return { error: result.error.message };
  }

  // Ligar/desligar mostra ou esconde o botão de ouvir em todo o site público.
  revalidatePath("/", "layout");
  return { error: null };
}

export type SpeechPanelActionState = { error: string | null; notice: string | null };

// "Tentar de novo": textos com falha voltam para a fila (de um conteúdo, ou todos sem `scope`).
export async function retryFailedSpeechAction(
  _prevState: SpeechPanelActionState,
  formData: FormData,
): Promise<SpeechPanelActionState> {
  const authz = await authorizeActor("settings.manage");
  if (!authz.authorized) return { error: authz.error.message, notice: null };

  const result = await retryFailedSpeech({ scope: String(formData.get("scope") ?? "") || null });
  if (!result.success) return { error: result.error.message, notice: null };
  revalidatePath("/admin/speech");
  const { requeued } = result.data;
  return { error: null, notice: requeued === 1 ? "1 texto voltou para a fila." : `${requeued} textos voltaram para a fila.` };
}

// "Gerar agora": pede uma execução do worker no GitHub Actions (SPEECH_WORKER_GITHUB_TOKEN).
export async function requestSpeechWorkerRunAction(): Promise<SpeechPanelActionState> {
  const authz = await authorizeActor("settings.manage");
  if (!authz.authorized) return { error: authz.error.message, notice: null };

  const result = await requestSpeechWorkerRun();
  if (!result.success) return { error: result.error.message, notice: null };
  revalidatePath("/admin/speech");
  return { error: null, notice: "Worker chamado: ele leva alguns minutos para instalar as vozes e começar." };
}
