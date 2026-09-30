import { getSetting, registerDefaultSetting } from "@/contexts/settings";

// Mesmo padrão de platform/header-behavior/get-header-behavior.ts: dado simples em
// contexts/settings, sem handler/service/store próprio (setSetting já cobre autorização/cache).
// Permite esconder o link de "Entrar" da navegação em instâncias onde só admins devem acessar
// login (ex: Erasto League) — a ROTA /login continua acessível por URL direta, isto só governa
// se o link aparece na navegação.
export type NavVisibility = {
  hideLoginLink: boolean;
  // Só tem efeito quando hideLoginLink=true — alternativa deliberada a esconder o login por
  // completo: mantém um link explícito no rodapé em vez do header.
  showLoginInFooter: boolean;
};

const KEYS = {
  hideLoginLink: "nav.hideLoginLink",
  showLoginInFooter: "nav.showLoginInFooter",
} as const;

const DEFAULTS: NavVisibility = {
  hideLoginLink: false,
  showLoginInFooter: false,
};

async function readBooleanSetting(key: string, defaultValue: boolean): Promise<boolean> {
  await registerDefaultSetting({ key, value: defaultValue });
  const result = await getSetting({ key });
  if (!result.success) return defaultValue;
  const record = result.data;
  if (!record || typeof record.value !== "boolean") return defaultValue;
  return record.value;
}

export async function getNavVisibility(): Promise<NavVisibility> {
  const [hideLoginLink, showLoginInFooter] = await Promise.all([
    readBooleanSetting(KEYS.hideLoginLink, DEFAULTS.hideLoginLink),
    readBooleanSetting(KEYS.showLoginInFooter, DEFAULTS.showLoginInFooter),
  ]);

  return { hideLoginLink, showLoginInFooter };
}

export { KEYS as NAV_VISIBILITY_SETTING_KEYS };
