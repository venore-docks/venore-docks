import { describe, expect, it, vi } from "vitest";

vi.mock("../../session/get-current-user/service", () => ({ getCurrentUserService: async () => ({ success: true, data: { id: "root" } }) }));
vi.mock("@/contexts/rbac", () => ({ getUserContext: async () => ({ success: true, data: { isSuperadmin: true } }) }));
const deleteOwnAccount = vi.fn();
vi.mock("./service", () => ({ deleteOwnAccount: (...a: unknown[]) => deleteOwnAccount(...a) }));

describe("deleteOwnAccountHandler", () => {
  it("never lets a superadmin delete their own account", async () => {
    const { deleteOwnAccountHandler } = await import("./handler");
    const result = await deleteOwnAccountHandler({ confirmEmail: "root@x.com", password: "p" });
    expect(result).toEqual(expect.objectContaining({ success: false, error: expect.objectContaining({ code: "auth.identity.superadmin_self_delete" }) }));
    expect(deleteOwnAccount).not.toHaveBeenCalled();
  });
});
