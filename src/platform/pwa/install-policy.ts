// Política do convite de instalação do PWA (core). Funções puras: o componente cliente só coleta
// o ambiente (matchMedia, localStorage, rota) e pergunta `shouldShowInstall`.
export const PWA_INSTALL_SETTING_KEY = "platform.pwa_install";
export const PWA_DISMISSED_AT_KEY = "pwa-install-dismissed-at";
export const PWA_INSTALLED_KEY = "pwa-installed";
export const PWA_VISITS_KEY = "pwa-visit-count";
export const PWA_DEFAULT_COOLDOWN_DAYS = 30;
export const PWA_MAX_COOLDOWN_DAYS = 365;

export type PwaInstallSetting = { enabled: boolean; cooldownDays: number; mobile: boolean; desktop: boolean };

export const PWA_INSTALL_DEFAULTS: PwaInstallSetting = {
  enabled: true,
  cooldownDays: PWA_DEFAULT_COOLDOWN_DAYS,
  mobile: true,
  desktop: true,
};

// Forma inesperada = padrão (ligado, 30 dias, mobile e desktop).
export function parsePwaInstallSetting(value: unknown): PwaInstallSetting {
  if (!value || typeof value !== "object") return { ...PWA_INSTALL_DEFAULTS };
  const record = value as Record<string, unknown>;
  const days = typeof record.cooldownDays === "number" && Number.isFinite(record.cooldownDays) ? Math.floor(record.cooldownDays) : NaN;
  return {
    enabled: record.enabled !== false,
    cooldownDays: days >= 0 && days <= PWA_MAX_COOLDOWN_DAYS ? days : PWA_DEFAULT_COOLDOWN_DAYS,
    mobile: record.mobile !== false,
    desktop: record.desktop !== false,
  };
}

// Rotas em que o convite nunca aparece: painel e fluxos de formulário/chamado.
const BLOCKED_PREFIXES = ["/admin", "/login", "/setup", "/chamados", "/colabora", "/account"];
export function isInstallBlockedPath(pathname: string): boolean {
  return BLOCKED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export type InstallEnv = {
  setting: PwaInstallSetting;
  pathname: string;
  isMobileViewport: boolean;
  standalone: boolean;
  installed: boolean;
  dismissedAt: number | null;
  now: number;
  visitCount: number;
  // "native": beforeinstallprompt capturado nesta sessão. "ios": Safari iOS (sem evento).
  channel: "native" | "ios" | "none";
};

export function shouldShowInstall(env: InstallEnv): boolean {
  const { setting } = env;
  if (!setting.enabled || env.channel === "none") return false;
  if (env.isMobileViewport ? !setting.mobile : !setting.desktop) return false;
  if (env.standalone || env.installed) return false;
  if (isInstallBlockedPath(env.pathname)) return false;
  // Quem acabou de logar (1ª visita da sessão do navegador) só vê o convite a partir da 2ª visita.
  if (env.visitCount < 2) return false;
  if (env.dismissedAt !== null && env.now - env.dismissedAt < setting.cooldownDays * 86_400_000) return false;
  return true;
}
