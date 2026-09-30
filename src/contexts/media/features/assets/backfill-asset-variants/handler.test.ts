import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeActor = vi.fn();
vi.mock("@/contexts/rbac", () => ({ authorizeActor: (...args: unknown[]) => authorizeActor(...args) }));

const backfillAssetVariants = vi.fn();
vi.mock("./service", () => ({ backfillAssetVariants: (...args: unknown[]) => backfillAssetVariants(...args) }));

describe("backfillAssetVariantsHandler", () => {
  beforeEach(() => {
    authorizeActor.mockReset();
    backfillAssetVariants.mockReset();
    backfillAssetVariants.mockResolvedValue({ success: true, data: { processed: 0, generated: 0, failed: 0, remaining: 0 } });
  });

  it("exige media.manage", async () => {
    authorizeActor.mockResolvedValue({ authorized: false, error: { code: "rbac.forbidden", message: "não" } });
    const { backfillAssetVariantsHandler } = await import("./handler");

    const result = await backfillAssetVariantsHandler();

    expect(authorizeActor).toHaveBeenCalledWith("media.manage");
    expect(result.success).toBe(false);
    expect(backfillAssetVariants).not.toHaveBeenCalled();
  });

  it("limita o tamanho do lote", async () => {
    authorizeActor.mockResolvedValue({ authorized: true, actorId: "admin-1" });
    const { backfillAssetVariantsHandler } = await import("./handler");

    await backfillAssetVariantsHandler({ limit: 500 });
    await backfillAssetVariantsHandler({ limit: 0 });
    await backfillAssetVariantsHandler();

    expect(backfillAssetVariants.mock.calls.map(([command]) => command.limit)).toEqual([20, 1, 8]);
  });
});
