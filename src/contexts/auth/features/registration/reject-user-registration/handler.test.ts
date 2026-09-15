import { beforeEach, describe, expect, it, vi } from "vitest";

const rejectUserRegistration = vi.fn();

vi.mock("./service", () => ({
  rejectUserRegistration: (...args: unknown[]) => rejectUserRegistration(...args),
}));

describe("rejectUserRegistrationHandler", () => {
  beforeEach(() => {
    rejectUserRegistration.mockReset();
  });

  it("rejects an empty userId without calling the service", async () => {
    const { rejectUserRegistrationHandler } = await import("./handler");
    const result = await rejectUserRegistrationHandler({ userId: "" });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.registrations.invalid_id", message: expect.any(String) },
    });
    expect(rejectUserRegistration).not.toHaveBeenCalled();
  });

  it("delegates to the service", async () => {
    rejectUserRegistration.mockResolvedValue({ success: true, data: undefined });

    const { rejectUserRegistrationHandler } = await import("./handler");
    const result = await rejectUserRegistrationHandler({ userId: "user-1" });

    expect(rejectUserRegistration).toHaveBeenCalledWith({ userId: "user-1" });
    expect(result).toEqual({ success: true, data: undefined });
  });
});
