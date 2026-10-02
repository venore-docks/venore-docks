import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeActor = vi.fn();
const setSetting = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@/contexts/rbac", () => ({ authorizeActor: (...args: unknown[]) => authorizeActor(...args) }));
vi.mock("@/contexts/settings", () => ({
  CORE_SETTING_DEFAULTS: { "platform.locale": "pt-BR", "platform.textDirection": "auto" },
  getSetting: vi.fn(),
  setSetting: (...args: unknown[]) => setSetting(...args),
}));
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

const { updateLocaleAction } = await import("./locale");

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("updateLocaleAction", () => {
  beforeEach(() => {
    authorizeActor.mockReset().mockResolvedValue({ authorized: true });
    setSetting.mockReset().mockResolvedValue({ success: true, data: {} });
    revalidatePath.mockReset();
  });

  it("exige settings.manage e não grava sem permissão", async () => {
    authorizeActor.mockResolvedValue({ authorized: false, error: { code: "rbac.forbidden", message: "Sem permissão." } });
    expect(await updateLocaleAction({ error: null }, form({ locale: "ar", textDirection: "auto" }))).toEqual({ error: "Sem permissão." });
    expect(authorizeActor).toHaveBeenCalledWith("settings.manage");
    expect(setSetting).not.toHaveBeenCalled();
  });

  it("grava o locale canônico e a direção", async () => {
    expect(await updateLocaleAction({ error: null }, form({ locale: "pt-br", textDirection: "rtl" }))).toEqual({ error: null });
    expect(setSetting).toHaveBeenCalledWith({ key: "platform.locale", value: "pt-BR" });
    expect(setSetting).toHaveBeenCalledWith({ key: "platform.textDirection", value: "rtl" });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("recusa locale ou direção inválidos sem gravar", async () => {
    expect((await updateLocaleAction({ error: null }, form({ locale: "not a locale", textDirection: "auto" }))).error).toMatch(/Idioma inválido/);
    expect((await updateLocaleAction({ error: null }, form({ locale: "ar", textDirection: "up" }))).error).toMatch(/Direção/);
    expect(setSetting).not.toHaveBeenCalled();
  });

  it("devolve o erro de setSetting", async () => {
    setSetting.mockResolvedValue({ success: false, error: { code: "x", message: "Falhou." } });
    expect(await updateLocaleAction({ error: null }, form({ locale: "en", textDirection: "auto" }))).toEqual({ error: "Falhou." });
  });
});
