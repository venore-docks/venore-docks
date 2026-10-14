import { beforeEach, describe, expect, it, vi } from "vitest";

const updateEntryLayout = vi.fn();
vi.mock("./service", () => ({ updateEntryLayout: (...args: unknown[]) => updateEntryLayout(...args) }));

const authorizeActor = vi.fn();
vi.mock("@/contexts/rbac", () => ({ authorizeActor: (...args: unknown[]) => authorizeActor(...args) }));

const { updateEntryLayoutHandler } = await import("./handler");

describe("updateEntryLayoutHandler", () => {
  beforeEach(() => {
    updateEntryLayout.mockReset();
    authorizeActor.mockReset();
    authorizeActor.mockResolvedValue({ authorized: true, actorId: "actor-1" });
    updateEntryLayout.mockResolvedValue({ success: true, data: { entryId: "e1", layout: {}, proposed: false } });
  });

  it("rejeita entryId vazio sem autorizar nem chamar o service", async () => {
    const result = await updateEntryLayoutHandler({ entryId: " ", layout: {} });
    expect(result).toMatchObject({ success: false, error: { code: "cms.entries.invalid_id" } });
    expect(authorizeActor).not.toHaveBeenCalled();
    expect(updateEntryLayout).not.toHaveBeenCalled();
  });

  it.each([
    [{ width: "huge" }],
    [{ rail: "visible" }],
    [{ contextualBar: "bottom" }],
    [{ template: "Não Válido!" }],
    [{ extra: 1 }],
    [null],
    [[]],
  ])("rejeita layout inválido %j", async (layout) => {
    const result = await updateEntryLayoutHandler({ entryId: "e1", layout: layout as never });
    expect(result).toMatchObject({ success: false, error: { code: "cms.entries.invalid_layout" } });
    expect(updateEntryLayout).not.toHaveBeenCalled();
  });

  it("exige cms.entries.manage e devolve o erro de autorização", async () => {
    authorizeActor.mockResolvedValue({ authorized: false, error: { code: "rbac.forbidden", message: "não" } });
    const result = await updateEntryLayoutHandler({ entryId: "e1", layout: { width: "full" } });
    expect(authorizeActor).toHaveBeenCalledWith("cms.entries.manage");
    expect(result).toEqual({ success: false, error: { code: "rbac.forbidden", message: "não" } });
    expect(updateEntryLayout).not.toHaveBeenCalled();
  });

  it("normaliza (auto/vazio somem) e repassa o actorId ao service", async () => {
    await updateEntryLayoutHandler({
      entryId: "e1",
      layout: { width: "wide", rail: "auto", contextualBar: "top", template: "" } as never,
    });
    expect(updateEntryLayout).toHaveBeenCalledWith({ entryId: "e1", layout: { width: "wide", contextualBar: "top" }, actorId: "actor-1" });
  });
});
