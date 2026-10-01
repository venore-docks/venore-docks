import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({ beginOperation: () => ({}), endOperation: () => undefined, recordAuditEvent: vi.fn(async () => undefined) }));
const incrementSessionVersion = vi.fn();
vi.mock("./store", () => ({ incrementSessionVersion: (...args: unknown[]) => incrementSessionVersion(...args) }));

describe("revokeSessions", () => {
  beforeEach(() => incrementSessionVersion.mockReset());

  it("bumps the session version so every older JWT stops being accepted", async () => {
    incrementSessionVersion.mockResolvedValue(3);
    const { revokeSessions } = await import("./service");
    expect(await revokeSessions({ userId: "u1", actorId: "u1", reason: "self" })).toEqual({ success: true, data: { sessionVersion: 3 } });
    expect(incrementSessionVersion).toHaveBeenCalledWith("u1");
  });

  it("reports an unknown user", async () => {
    incrementSessionVersion.mockResolvedValue(null);
    const { revokeSessions } = await import("./service");
    expect((await revokeSessions({ userId: "x", actorId: "a", reason: "admin" })).success).toBe(false);
  });
});
