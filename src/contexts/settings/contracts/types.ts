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
  "speech",
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

// Chaves core novas da v8 de temas (spec §4.1) e o valor que vale quando a linha não existe.
// Leitura de render NUNCA insere (registerDefaultSetting gravaria no banco a cada processo):
// quem lê aplica este padrão. `theme.config` ausente é significativo — dispara a síntese a partir
// de theme.active/theme.activePaletteId — por isso o padrão dele é `null`, nunca um documento.
// Todas em namespaces core ("theme", "platform") ⇒ escrita exige settings.manage.
export const CORE_SETTING_DEFAULTS = {
  "theme.config": null,
  "platform.locale": "pt-BR",
  "platform.textDirection": "auto",
  "platform.maintenance": { enabled: false, message: "" },
} as const satisfies Record<string, unknown>;
export type CoreSettingDefaultKey = keyof typeof CORE_SETTING_DEFAULTS;
