import { beforeEach, describe, expect, it, vi } from "vitest";

const rejectRegistration = vi.fn();

vi.mock("./service", () => ({
  rejectRegistration: (...args: unknown[]) => rejectRegistration(...args),
}));

const authorizeActor = vi.fn();

vi.mock("../../../authorize-actor", () => ({
  authorizeActor: (...args: unknown[]) => authorizeActor(...args),
}));

describe("rejectRegistrationHandler", () => {
  beforeEach(() => {
    rejectRegistration.mockReset();
    authorizeActor.mockReset();
    authorizeActor.mockResolvedValue({ authorized: true, actorId: "admin-1" });
  });

  it("rejects an empty userId without checking authorization", async () => {
    const { rejectRegistrationHandler } = await import("./handler");
    const result = await rejectRegistrationHandler({ userId: "" });

    expect(result).toEqual({
      success: false,
      error: { code: "rbac.registrations.invalid_id", message: expect.any(String) },
    });
    expect(authorizeActor).not.toHaveBeenCalled();
    expect(rejectRegistration).not.toHaveBeenCalled();
  });

  it("rejects an actor without rbac.registrations.approve", async () => {
    authorizeActor.mockResolvedValue({
      authorized: false,
      error: { code: "rbac.authorization.forbidden", message: "sem permission" },
    });

    const { rejectRegistrationHandler } = await import("./handler");
    const result = await rejectRegistrationHandler({ userId: "user-1" });

    expect(result).toEqual({
      success: false,
      error: { code: "rbac.authorization.forbidden", message: "sem permission" },
    });
    expect(authorizeActor).toHaveBeenCalledWith("rbac.registrations.approve");
    expect(rejectRegistration).not.toHaveBeenCalled();
  });

  it("delegates to the service with the resolved actor when authorized", async () => {
    rejectRegistration.mockResolvedValue({ success: true, data: undefined });

    const { rejectRegistrationHandler } = await import("./handler");
    const result = await rejectRegistrationHandler({ userId: "user-1", reason: "spam" });

    expect(rejectRegistration).toHaveBeenCalledWith({ userId: "user-1", reason: "spam", actor: { id: "admin-1" } });
    expect(result).toEqual({ success: true, data: undefined });
  });
});
