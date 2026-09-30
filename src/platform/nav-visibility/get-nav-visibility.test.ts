import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSetting, registerDefaultSetting } = vi.hoisted(() => ({
  getSetting: vi.fn(),
  registerDefaultSetting: vi.fn(),
}));

vi.mock("@/contexts/settings", () => ({ getSetting, registerDefaultSetting }));

import { getNavVisibility } from "./get-nav-visibility";

describe("getNavVisibility", () => {
  beforeEach(() => {
    getSetting.mockReset();
    registerDefaultSetting.mockReset().mockResolvedValue({ success: true, data: { registered: false } });
  });

  it("lê as duas chaves sem o cache em memória por processo (skipCache)", async () => {
    getSetting.mockResolvedValue({ success: true, data: null });

    await getNavVisibility();

    expect(getSetting).toHaveBeenCalledWith({ key: "nav.hideLoginLink", skipCache: true });
    expect(getSetting).toHaveBeenCalledWith({ key: "nav.showLoginInFooter", skipCache: true });
  });

  it("devolve o valor salvo pelo admin", async () => {
    getSetting.mockImplementation(async ({ key }: { key: string }) => ({
      success: true,
      data: { key, value: key === "nav.hideLoginLink" },
    }));

    expect(await getNavVisibility()).toEqual({ hideLoginLink: true, showLoginInFooter: false });
  });

  it("cai no default (tudo false) quando a leitura falha ou o valor não é boolean", async () => {
    getSetting
      .mockResolvedValueOnce({ success: false, error: { code: "x", message: "x" } })
      .mockResolvedValueOnce({ success: true, data: { key: "nav.showLoginInFooter", value: "sim" } });

    expect(await getNavVisibility()).toEqual({ hideLoginLink: false, showLoginInFooter: false });
  });
});
