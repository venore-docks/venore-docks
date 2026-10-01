import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeActor = vi.fn();
vi.mock("@/contexts/rbac", () => ({
  authorizeActor: (...args: unknown[]) => authorizeActor(...args),
}));

const setSetting = vi.fn();
vi.mock("./service", () => ({
  setSetting: (...args: unknown[]) => setSetting(...args),
}));

import { setSettingHandler } from "./handler";

describe("setSettingHandler — permission por namespace (G5)", () => {
  beforeEach(() => {
    authorizeActor.mockReset().mockResolvedValue({ authorized: true, actorId: "actor-1" });
    setSetting.mockReset().mockResolvedValue({ success: true, data: { key: "x", value: 1, updatedAt: new Date() } });
  });

  it("setting de plugin aceita settings.manage OU <plugin>.settings.manage", async () => {
    await setSettingHandler({ key: "birthdays.reminder_days", value: 7 });

    expect(authorizeActor).toHaveBeenCalledWith(["settings.manage", "birthdays.settings.manage"]);
    expect(setSetting).toHaveBeenCalledWith({ key: "birthdays.reminder_days", value: 7, actorId: "actor-1" });
  });

  it.each(["theme.active", "nav.hideLoginLink", "auth.registration_default_role", "brand.siteName", "media.softDeleteGraceDays"])(
    "setting do core (%s) continua exigindo só settings.manage",
    async (key) => {
      await setSettingHandler({ key, value: true });
      expect(authorizeActor).toHaveBeenCalledWith(["settings.manage"]);
    },
  );

  it("chave sem namespace exige settings.manage", async () => {
    await setSettingHandler({ key: "semponto", value: 1 });
    expect(authorizeActor).toHaveBeenCalledWith(["settings.manage"]);
  });

  it("não grava quando o ator não tem nenhuma das permissions", async () => {
    const error = { code: "rbac.authorization.forbidden", message: "sem permissão" };
    authorizeActor.mockResolvedValue({ authorized: false, error });

    const result = await setSettingHandler({ key: "birthdays.reminder_days", value: 7 });

    expect(result).toEqual({ success: false, error });
    expect(setSetting).not.toHaveBeenCalled();
  });
});
