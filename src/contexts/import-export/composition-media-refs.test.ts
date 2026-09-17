import { describe, expect, it } from "vitest";
import type { Composition } from "@/contexts/cms";
import { remapCompositionMediaIds } from "./composition-media-refs";

function block(overrides: Partial<Composition[number]>): Composition[number] {
  return { id: "b1", key: "core.content.image", slot: "main", htmlId: null, data: {}, areas: [], ...overrides };
}

describe("remapCompositionMediaIds", () => {
  it("rewrites data.mediaId at the top level using the resolver", () => {
    const composition: Composition = [block({ data: { mediaId: "old-id", alt: "" } })];

    const result = remapCompositionMediaIds(composition, (id) => (id === "old-id" ? "new-id" : null));

    expect(result[0].data.mediaId).toBe("new-id");
  });

  it("rewrites mediaId nested inside a row block's areas", () => {
    const composition: Composition = [
      block({
        key: "core.layout.row",
        data: { columns: 2 },
        areas: [
          { key: "col-1", blocks: [block({ id: "b2", data: { mediaId: "old-id" } })] },
          { key: "col-2", blocks: [] },
        ],
      }),
    ];

    const result = remapCompositionMediaIds(composition, () => "new-id");

    expect(result[0].areas[0].blocks[0].data.mediaId).toBe("new-id");
  });

  it("resolves to null when the resolver can't find a match, instead of leaving a dangling id", () => {
    const composition: Composition = [block({ data: { mediaId: "unknown-id" } })];

    const result = remapCompositionMediaIds(composition, () => null);

    expect(result[0].data.mediaId).toBeNull();
  });

  it("leaves blocks without a mediaId field untouched", () => {
    const composition: Composition = [block({ key: "core.content.text", data: { body: "hello" } })];

    const result = remapCompositionMediaIds(composition, () => "new-id");

    expect(result[0].data).toEqual({ body: "hello" });
  });

  it("leaves a block with mediaId already null untouched (never calls the resolver)", () => {
    const composition: Composition = [block({ data: { mediaId: null } })];
    let calls = 0;

    const result = remapCompositionMediaIds(composition, () => {
      calls += 1;
      return "new-id";
    });

    expect(result[0].data.mediaId).toBeNull();
    expect(calls).toBe(0);
  });
});
