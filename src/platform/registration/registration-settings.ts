import { getSetting, registerDefaultSetting } from "@/contexts/settings";

export const REGISTRATION_APPROVAL_REQUIRED_SETTING_KEY = "auth.registration_approval_required";
// Liga/desliga o AUTOCADASTRO (formulário "Criar conta" e primeiro login OAuth de alguém sem
// conta). Desligado, só o admin cria contas (/admin/community).
export const SELF_REGISTRATION_ENABLED_SETTING_KEY = "auth.self_registration_enabled";

// Leitura tolerante e fail-safe: setting ausente ou erro na leitura cai no comportamento seguro.
// Valor é boolean real (jsonb parseado pelo driver) — comparar com string nunca bateria.
async function readBooleanSetting(key: string, fallback: boolean): Promise<boolean> {
  const result = await getSetting({ key });
  if (!result.success || !result.data || typeof result.data.value !== "boolean") {
    return fallback;
  }
  return result.data.value;
}

export function isApprovalRequired(): Promise<boolean> {
  return readBooleanSetting(REGISTRATION_APPROVAL_REQUIRED_SETTING_KEY, true);
}

// Default true preserva o comportamento de instâncias existentes (o formulário "Criar conta"
// sempre existiu). Erro de leitura = fechado.
export async function isSelfRegistrationEnabled(): Promise<boolean> {
  const result = await getSetting({ key: SELF_REGISTRATION_ENABLED_SETTING_KEY });
  if (!result.success) return false;
  if (!result.data || typeof result.data.value !== "boolean") return true;
  return result.data.value;
}

// INSERT ... ON CONFLICT DO NOTHING — nunca sobrescreve um valor já ajustado por um admin.
export async function ensureRegistrationSettingsRegistered(): Promise<void> {
  await registerDefaultSetting({ key: REGISTRATION_APPROVAL_REQUIRED_SETTING_KEY, value: true });
  await registerDefaultSetting({ key: SELF_REGISTRATION_ENABLED_SETTING_KEY, value: true });
}
