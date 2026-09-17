import { describe, expect, it } from "vitest";
import type { Block, BlockDefinition, Composition } from "@/contexts/cms";
import {
  addChild,
  appendToRoot,
  createBlock,
  duplicateBlock,
  findBlock,
  getPositionContext,
  insertSibling,
  moveBlock,
  removeBlock,
  resolveErrorBlockId,
  updateBlockData,
} from "./composition-tree";

const textDefinition: BlockDefinition = {
  key: "text",
  label: "Texto",
  category: "conteúdo",
  structure: "leaf",
  allowedInRoot: false,
  defaultData: { text: "" },
  editorFields: [{ name: "text", type: "text", label: "Texto" }],
};

const rowDefinition: BlockDefinition = {
  key: "row",
  label: "Linha",
  category: "estrutura",
  structure: "areas",
  allowedInRoot: true,
  defaultData: {},
  editorFields: [],
  areaDefinitions: [
    { key: "left", label: "Esquerda", allowedBlockKeys: ["text"] },
    { key: "right", label: "Direita", allowedBlockKeys: ["text"] },
  ],
};

function resolveDefinition(key: string): BlockDefinition | null {
  if (key === "text") return textDefinition;
  if (key === "row") return rowDefinition;
  return null;
}

function block(overrides: Partial<Block>): Block {
  return { id: "b1", key: "text", slot: "", htmlId: null, data: {}, areas: [], ...overrides };
}

describe("createBlock", () => {
  it("gives leaf blocks empty areas and a copy of defaultData", () => {
    const created = createBlock(textDefinition);
    expect(created.areas).toEqual([]);
    expect(created.data).toEqual({ text: "" });
    expect(created.data).not.toBe(textDefinition.defaultData);
  });

  it("pre-creates one empty area per areaDefinition for structure: areas blocks", () => {
    const created = createBlock(rowDefinition);
    expect(created.areas).toEqual([
      { key: "left", blocks: [] },
      { key: "right", blocks: [] },
    ]);
  });

  it("generates a fresh id on every call", () => {
    const a = createBlock(textDefinition);
    const b = createBlock(textDefinition);
    expect(a.id).not.toEqual(b.id);
  });
});

describe("findBlock", () => {
  it("finds a root block and a nested block", () => {
    const composition: Composition = [
      block({ id: "root-1" }),
      block({
        id: "row-1",
        key: "row",
        areas: [{ key: "left", blocks: [block({ id: "nested-1" })] }, { key: "right", blocks: [] }],
      }),
    ];

    expect(findBlock(composition, "root-1")?.id).toBe("root-1");
    expect(findBlock(composition, "nested-1")?.id).toBe("nested-1");
    expect(findBlock(composition, "missing")).toBeNull();
  });
});

describe("insertSibling", () => {
  it("inserts after a root block without touching unrelated blocks", () => {
    const composition: Composition = [block({ id: "a" }), block({ id: "b" })];
    const next = insertSibling(composition, "a", block({ id: "new" }), "after");

    expect(next.map((b) => b.id)).toEqual(["a", "new", "b"]);
    expect(composition.map((b) => b.id)).toEqual(["a", "b"]);
  });

  it("inserts before a root block", () => {
    const composition: Composition = [block({ id: "a" }), block({ id: "b" })];
    const next = insertSibling(composition, "b", block({ id: "new" }), "before");

    expect(next.map((b) => b.id)).toEqual(["a", "new", "b"]);
  });

  it("inserts a sibling next to a block nested inside an area", () => {
    const composition: Composition = [
      block({
        id: "row-1",
        key: "row",
        areas: [{ key: "left", blocks: [block({ id: "nested-1" })] }, { key: "right", blocks: [] }],
      }),
    ];

    const next = insertSibling(composition, "nested-1", block({ id: "nested-2" }), "after");

    expect(next[0].areas[0].blocks.map((b) => b.id)).toEqual(["nested-1", "nested-2"]);
    expect(next[0].areas[1].blocks).toEqual([]);
  });
});

describe("appendToRoot", () => {
  it("adds a block at the end of the root list", () => {
    const composition: Composition = [block({ id: "a" })];
    const next = appendToRoot(composition, block({ id: "b" }));
    expect(next.map((b) => b.id)).toEqual(["a", "b"]);
  });
});

describe("addChild", () => {
  it("adds a block into a specific area of a parent block", () => {
    const composition: Composition = [
      block({ id: "row-1", key: "row", areas: [{ key: "left", blocks: [] }, { key: "right", blocks: [] }] }),
    ];

    const next = addChild(composition, "row-1", "right", block({ id: "child-1" }));

    expect(next[0].areas[0].blocks).toEqual([]);
    expect(next[0].areas[1].blocks.map((b) => b.id)).toEqual(["child-1"]);
  });
});

describe("removeBlock", () => {
  it("removes a root block", () => {
    const composition: Composition = [block({ id: "a" }), block({ id: "b" })];
    expect(removeBlock(composition, "a").map((b) => b.id)).toEqual(["b"]);
  });

  it("removes a nested block along with its own subtree", () => {
    const composition: Composition = [
      block({
        id: "row-1",
        key: "row",
        areas: [{ key: "left", blocks: [block({ id: "nested-1" })] }, { key: "right", blocks: [] }],
      }),
    ];

    const next = removeBlock(composition, "nested-1");
    expect(next[0].areas[0].blocks).toEqual([]);
  });

  it("is a no-op when the id does not exist", () => {
    const composition: Composition = [block({ id: "a" })];
    expect(removeBlock(composition, "missing")).toEqual(composition);
  });
});

describe("moveBlock", () => {
  it("moves a block up and down among root siblings", () => {
    const composition: Composition = [block({ id: "a" }), block({ id: "b" }), block({ id: "c" })];

    expect(moveBlock(composition, "b", "up").map((b) => b.id)).toEqual(["b", "a", "c"]);
    expect(moveBlock(composition, "b", "down").map((b) => b.id)).toEqual(["a", "c", "b"]);
  });

  it("does nothing when moving past either edge", () => {
    const composition: Composition = [block({ id: "a" }), block({ id: "b" })];

    expect(moveBlock(composition, "a", "up").map((b) => b.id)).toEqual(["a", "b"]);
    expect(moveBlock(composition, "b", "down").map((b) => b.id)).toEqual(["a", "b"]);
  });

  it("moves within an area without affecting siblings at other levels", () => {
    const composition: Composition = [
      block({
        id: "row-1",
        key: "row",
        areas: [{ key: "left", blocks: [block({ id: "x" }), block({ id: "y" })] }, { key: "right", blocks: [] }],
      }),
    ];

    const next = moveBlock(composition, "y", "up");
    expect(next[0].areas[0].blocks.map((b) => b.id)).toEqual(["y", "x"]);
  });
});

describe("duplicateBlock", () => {
  it("clones a leaf block with a new id right after the original", () => {
    const composition: Composition = [block({ id: "a", data: { text: "hi" } })];
    const next = duplicateBlock(composition, "a");

    expect(next).toHaveLength(2);
    expect(next[0].id).toBe("a");
    expect(next[1].id).not.toBe("a");
    expect(next[1].data).toEqual({ text: "hi" });
  });

  it("recursively assigns new ids to every descendant, never reusing one", () => {
    const composition: Composition = [
      block({
        id: "row-1",
        key: "row",
        areas: [{ key: "left", blocks: [block({ id: "child-1" })] }, { key: "right", blocks: [] }],
      }),
    ];

    const next = duplicateBlock(composition, "row-1");
    const clone = next[1];

    expect(clone.id).not.toBe("row-1");
    expect(clone.areas[0].blocks[0].id).not.toBe("child-1");
    expect(clone.areas[0].blocks[0].data).toEqual(composition[0].areas[0].blocks[0].data);
  });

  it("is a no-op when the id does not exist", () => {
    const composition: Composition = [block({ id: "a" })];
    expect(duplicateBlock(composition, "missing")).toEqual(composition);
  });
});

describe("updateBlockData", () => {
  it("replaces a block's data without touching siblings", () => {
    const composition: Composition = [block({ id: "a", data: { text: "old" } }), block({ id: "b", data: { text: "keep" } })];
    const next = updateBlockData(composition, "a", { text: "new" });

    expect(next[0].data).toEqual({ text: "new" });
    expect(next[1].data).toEqual({ text: "keep" });
  });
});

describe("getPositionContext", () => {
  it("reports root position for a root block", () => {
    const composition: Composition = [block({ id: "a" })];
    expect(getPositionContext(composition, "a", resolveDefinition)).toEqual({ isRoot: true });
  });

  it("reports the owning area and its allowedBlockKeys for a nested block", () => {
    const composition: Composition = [
      block({
        id: "row-1",
        key: "row",
        areas: [{ key: "left", blocks: [block({ id: "nested-1" })] }, { key: "right", blocks: [] }],
      }),
    ];

    expect(getPositionContext(composition, "nested-1", resolveDefinition)).toEqual({
      isRoot: false,
      areaKey: "left",
      allowedBlockKeys: ["text"],
    });
  });

  it("returns null when the block does not exist", () => {
    const composition: Composition = [block({ id: "a" })];
    expect(getPositionContext(composition, "missing", resolveDefinition)).toBeNull();
  });
});

describe("resolveErrorBlockId", () => {
  it("resolves a root-level path to the offending block", () => {
    const composition: Composition = [block({ id: "a" }), block({ id: "b" })];
    expect(resolveErrorBlockId(composition, "$[1]")).toBe("b");
  });

  it("resolves a nested path through an area to the offending block", () => {
    const composition: Composition = [
      block({
        id: "row-1",
        key: "row",
        areas: [{ key: "left", blocks: [block({ id: "x" }), block({ id: "y" })] }, { key: "right", blocks: [] }],
      }),
    ];

    expect(resolveErrorBlockId(composition, "$[0].areas[0][1]")).toBe("y");
  });

  it("blames the parent block when the area itself is the problem", () => {
    const composition: Composition = [block({ id: "row-1", key: "row", areas: [{ key: "left", blocks: [] }] })];
    expect(resolveErrorBlockId(composition, "$[0].areas[0]")).toBe("row-1");
  });
});
