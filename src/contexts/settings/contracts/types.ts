export type SettingRecord = { key: string; value: unknown; updatedAt: Date };

// Namespaces de chave (trecho antes do 1º ".") que são do core. Setting nesses namespaces só é
// gravada com `settings.manage`. Fora deles (settings de plugin, ex: "birthdays.reminder_days"),
// também vale `<namespace>.settings.manage` — permission que o próprio plugin declara no
// manifesto (o manifest-schema obriga permission de plugin a começar com a key do plugin, então
// só o plugin dono do namespace consegue declará-la). Lista explícita em vez de "qualquer coisa
// que não seja plugin" porque contexts/settings não conhece o registro de plugins (regra 12).
export const CORE_SETTING_NAMESPACES = [
  "auth",
  "brand",
  "cms",
  "contact",
  "header",
  "media",
  "nav",
  "platform",
  "privacy",
  "rbac",
  "seo",
  "settings",
  "theme",
] as const;

export function settingNamespaceOf(key: string): string {
  const dot = key.indexOf(".");
  return dot === -1 ? "" : key.slice(0, dot);
}

// Permissions que autorizam gravar `key` (qualquer uma basta — authorizeActor com lista é OR).
export function permissionsToWriteSetting(key: string): string[] {
  const namespace = settingNamespaceOf(key);
  if (namespace.length === 0 || (CORE_SETTING_NAMESPACES as readonly string[]).includes(namespace)) {
    return ["settings.manage"];
  }
  return ["settings.manage", `${namespace}.settings.manage`];
}
