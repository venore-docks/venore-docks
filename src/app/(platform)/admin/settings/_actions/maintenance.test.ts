import { beforeEach, describe, expect, it, vi } from "vitest";

// Action do modo manutenção (spec v8 §7.9/§9): settings.manage antes de qualquer gravação.
const mocks = vi.hoisted(() => ({
  authorized: true,
  setSetting: vi.fn(async (input: { key: string; value: unknown }) => {
    void input;
    return { success: true as const, data: {} };
  }),
  revalidatePath: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/contexts/rbac", () => ({
  authorizeActor: async (permission: string) =>
    mocks.authorized && permission === "settings.manage"
      ? { authorized: true, actorId: "u1" }
      : { authorized: false, error: { code: "rbac.forbidden", message: "Sem permissão." } },
}));
vi.mock("@/contexts/settings", () => ({
  setSetting: mocks.setSetting,
  getSetting: async () => ({ success: true, data: null }),
  CORE_SETTING_DEFAULTS: { "platform.maintenance": { enabled: false, message: "" } },
}));

const { updateMaintenanceAction } = await import("./maintenance");

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

beforeEach(() => {
  mocks.authorized = true;
  mocks.setSetting.mockClear();
  mocks.revalidatePath.mockClear();
});

describe("updateMaintenanceAction", () => {
  it("sem settings.manage: erro e nada gravado", async () => {
    mocks.authorized = false;
    expect(await updateMaintenanceAction({ error: null }, form({ enabled: "on" }))).toEqual({ error: "Sem permissão." });
    expect(mocks.setSetting).not.toHaveBeenCalled();
  });

  it("grava { enabled, message } em platform.maintenance", async () => {
    expect(await updateMaintenanceAction({ error: null }, form({ enabled: "on", message: "  Volto já  " }))).toEqual({ error: null });
    expect(mocks.setSetting).toHaveBeenCalledWith({ key: "platform.maintenance", value: { enabled: true, message: "Volto já" } });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("checkbox desmarcado desliga; mensagem longa demais é recusada", async () => {
    await updateMaintenanceAction({ error: null }, form({}));
    expect(mocks.setSetting).toHaveBeenCalledWith({ key: "platform.maintenance", value: { enabled: false, message: "" } });
    mocks.setSetting.mockClear();
    const result = await updateMaintenanceAction({ error: null }, form({ enabled: "on", message: "x".repeat(501) }));
    expect(result.error).toMatch(/500/);
    expect(mocks.setSetting).not.toHaveBeenCalled();
  });
});
