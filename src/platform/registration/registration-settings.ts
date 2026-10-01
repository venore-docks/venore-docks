import { getSetting, registerDefaultSetting } from "@/contexts/settings";

export const REGISTRATION_APPROVAL_REQUIRED_SETTING_KEY = "auth.registration_approval_required";
// Liga/desliga o AUTOCADASTRO (formulário "Criar conta" e primeiro login OAuth de alguém sem
// conta). Desligado, só o admin cria contas (/admin/community).
export const SELF_REGISTRATION_ENABLED_SETTING_KEY = "auth.self_registration_enabled";
// Papel que conta nova recebe (autocadastro sem aprovação, aprovação sem papel escolhido, conta
// criada pelo admin, convite cujo papel não pôde ser concedido). Guarda a `key` do papel. Sem
// valor salvo, vale a env RBAC_DEFAULT_REGISTRATION_ROLE_KEY ou "member" — resolvido em
// contexts/rbac (assign-default-role/service.ts), que também recusa "superadmin".
export const REGISTRATION_DEFAULT_ROLE_SETTING_KEY = "auth.registration_default_role";

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

// undefined = sem escolha do admin (rbac aplica o fallback). Não é registrado como default de
// propósito: gravar "member" aqui passaria por cima da env var de instâncias que já a usam.
export async function getDefaultRegistrationRoleKey(): Promise<string | undefined> {
  const result = await getSetting({ key: REGISTRATION_DEFAULT_ROLE_SETTING_KEY });
  if (!result.success || !result.data || typeof result.data.value !== "string") return undefined;
  const key = result.data.value.trim();
  return key.length > 0 ? key : undefined;
}

// INSERT ... ON CONFLICT DO NOTHING — nunca sobrescreve um valor já ajustado por um admin.
export async function ensureRegistrationSettingsRegistered(): Promise<void> {
  await registerDefaultSetting({ key: REGISTRATION_APPROVAL_REQUIRED_SETTING_KEY, value: true });
  await registerDefaultSetting({ key: SELF_REGISTRATION_ENABLED_SETTING_KEY, value: true });
}
