import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeActor = vi.fn();
vi.mock("@/contexts/rbac", () => ({ authorizeActor: (...args: unknown[]) => authorizeActor(...args) }));

const importSiteBundle = vi.fn();
vi.mock("./service", () => ({ importSiteBundle: (...args: unknown[]) => importSiteBundle(...args) }));

const resolveDefinition = vi.fn();

describe("importSiteBundleHandler", () => {
  beforeEach(() => {
    authorizeActor.mockReset().mockResolvedValue({ authorized: true, actorId: "admin" });
    importSiteBundle.mockReset().mockResolvedValue({ success: true, data: { lines: [] } });
  });

  it("authorizes before reading the uploaded body", async () => {
    authorizeActor.mockResolvedValue({ authorized: false, error: { code: "rbac.authorization.unauthenticated", message: "no" } });
    const readZipData = vi.fn();
    const { importSiteBundleHandler } = await import("./handler");

    const result = await importSiteBundleHandler({ declaredSize: 10, readZipData, resolveDefinition });

    expect(result.success).toBe(false);
    expect(readZipData).not.toHaveBeenCalled();
  });

  it("refuses a missing or oversized Content-Length without reading the body", async () => {
    const readZipData = vi.fn();
    const { importSiteBundleHandler } = await import("./handler");

    const missing = await importSiteBundleHandler({ declaredSize: null, readZipData, resolveDefinition });
    const huge = await importSiteBundleHandler({ declaredSize: 10 * 1024 * 1024 * 1024, readZipData, resolveDefinition });

    expect(missing).toEqual(expect.objectContaining({ success: false, error: expect.objectContaining({ code: "import-export.length_required" }) }));
    expect(huge).toEqual(expect.objectContaining({ success: false, error: expect.objectContaining({ code: "import-export.too_large" }) }));
    expect(readZipData).not.toHaveBeenCalled();
  });

  it("reports an unreadable zip as invalid instead of throwing", async () => {
    const { importSiteBundleHandler } = await import("./handler");
    const result = await importSiteBundleHandler({ declaredSize: 3, readZipData: async () => Buffer.from("zip"), resolveDefinition });
    expect(result).toEqual(expect.objectContaining({ success: false, error: expect.objectContaining({ code: "import-export.invalid_zip" }) }));
    expect(importSiteBundle).not.toHaveBeenCalled();
  });
});
