import { describe, expect, it } from "vitest";
import { isInstallBlockedPath, parsePwaInstallSetting, PWA_INSTALL_DEFAULTS, shouldShowInstall, type InstallEnv } from "./install-policy";

const DAY = 86_400_000;
const base: InstallEnv = {
  setting: PWA_INSTALL_DEFAULTS,
  pathname: "/",
  isMobileViewport: true,
  standalone: false,
  installed: false,
  dismissedAt: null,
  now: 100 * DAY,
  visitCount: 2,
  channel: "native",
};
const show = (patch: Partial<InstallEnv>) => shouldShowInstall({ ...base, ...patch });

describe("shouldShowInstall", () => {
  it("mostra na primeira visita elegivel (evento capturado, nao instalado, nao dispensado)", () => {
    expect(show({})).toBe(true);
    expect(show({ channel: "ios" })).toBe(true);
  });
  it("nao mostra sem evento nem iOS", () => expect(show({ channel: "none" })).toBe(false));
  it("nao mostra standalone ou ja instalado", () => {
    expect(show({ standalone: true })).toBe(false);
    expect(show({ installed: true })).toBe(false);
  });
  it("respeita cooldown de 30 dias apos dispensar", () => {
    expect(show({ dismissedAt: 100 * DAY - 29 * DAY })).toBe(false);
    expect(show({ dismissedAt: 100 * DAY - 31 * DAY })).toBe(true);
  });
  it("nao mostra em /admin, formularios e chamados", () => {
    for (const pathname of ["/admin", "/admin/plugins", "/chamados/novo", "/login"]) expect(show({ pathname })).toBe(false);
    expect(show({ pathname: "/administracao" })).toBe(true);
  });
  it("espera a 2a visita", () => expect(show({ visitCount: 1 })).toBe(false));
  it("respeita configuracao (desligado, so mobile, so desktop, cooldown 0)", () => {
    expect(show({ setting: { ...PWA_INSTALL_DEFAULTS, enabled: false } })).toBe(false);
    expect(show({ setting: { ...PWA_INSTALL_DEFAULTS, mobile: false } })).toBe(false);
    expect(show({ setting: { ...PWA_INSTALL_DEFAULTS, desktop: false }, isMobileViewport: false })).toBe(false);
    expect(show({ setting: { ...PWA_INSTALL_DEFAULTS, cooldownDays: 0 }, dismissedAt: base.now - 1 })).toBe(true);
  });
});

describe("parsePwaInstallSetting / isInstallBlockedPath", () => {
  it("usa padrao para valor inesperado", () => {
    expect(parsePwaInstallSetting(null)).toEqual(PWA_INSTALL_DEFAULTS);
    expect(parsePwaInstallSetting({ cooldownDays: -3 }).cooldownDays).toBe(30);
    expect(parsePwaInstallSetting({ enabled: false, cooldownDays: 7 })).toMatchObject({ enabled: false, cooldownDays: 7 });
  });
  it("bloqueia por segmento", () => expect(isInstallBlockedPath("/admin/x")).toBe(true));
});
