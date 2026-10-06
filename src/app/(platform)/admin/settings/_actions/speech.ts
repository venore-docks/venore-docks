"use server";

import { revalidatePath } from "next/cache";
import { authorizeActor } from "@/contexts/rbac";
import { setSetting } from "@/contexts/settings";
import {
  isSpeechVoice,
  MAX_MONTHLY_CHARACTER_LIMIT,
  SPEECH_ENABLED_SETTING_KEY,
  SPEECH_MONTHLY_LIMIT_SETTING_KEY,
  SPEECH_VOICE_SETTING_KEY,
} from "@/contexts/speech";

export type SpeechSettingsActionState = { error: string | null };

// Leitura em voz alta (docs/speech/google-cloud-tts.md). settings.manage é checado aqui (antes
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
