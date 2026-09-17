import { describe, expect, it } from "vitest";
import type { Block } from "./contracts/block";
import type { BlockDefinition } from "./contracts/block-definition";
import { validateComposition } from "./validate-composition";

const textDefinition: BlockDefinition = {
  key: "text",
  label: "Texto",
  category: "content",
  structure: "leaf",
  defaultData: {},
  editorFields: [],
  allowedInRoot: true,
};

const columnsDefinition: BlockDefinition = {
  key: "columns",
  label: "Colunas",
  category: "layout",
  structure: "areas",
  defaultData: {},
  editorFields: [],
  allowedInRoot: true,
  areaDefinitions: [
    { key: "left", label: "Esquerda", allowedBlockKeys: ["text", "columns"] },
    { key: "right", label: "Direita", allowedBlockKeys: ["text", "columns"] },
  ],
};

const imageDefinition: BlockDefinition = {
  key: "image",
  label: "Imagem",
  category: "content",
  structure: "leaf",
  defaultData: {},
  editorFields: [],
  allowedInRoot: true,
};

const definitions: Record<string, BlockDefinition> = {
  text: textDefinition,
  columns: columnsDefinition,
  image: imageDefinition,
};

function resolveDefinition(key: string): BlockDefinition | null {
  return definitions[key] ?? null;
}

function block(overrides: Partial<Block>): Block {
  return { id: "b1", key: "text", slot: "main", htmlId: null, data: {}, areas: [], ...overrides };
}

describe("validateComposition", () => {
  it("accepts a valid composition", () => {
    const composition: Block[] = [
      block({ id: "b1", key: "text" }),
      block({
        id: "b2",
        key: "columns",
        areas: [
          { key: "left", blocks: [block({ id: "b3", key: "text" })] },
          { key: "right", blocks: [] },
        ],
      }),
    ];

    expect(validateComposition(composition, resolveDefinition)).toEqual({ valid: true });
  });

  it("rejects an unknown block key", () => {
    const composition: Block[] = [block({ id: "b1", key: "mystery" })];

    const result = validateComposition(composition, resolveDefinition);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toMatchObject({ code: "cms.composition.unknown_block", path: "$[0]" });
    }
  });

  it("rejects a block placed in an area it does not belong to", () => {
    const composition: Block[] = [
      block({
        id: "b1",
        key: "columns",
        areas: [{ key: "left", blocks: [block({ id: "b2", key: "image" })] }],
      }),
    ];

    const result = validateComposition(composition, resolveDefinition);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toMatchObject({ code: "cms.composition.block_not_allowed_in_area" });
    }
  });

  it("rejects an area not declared by the block's definition", () => {
    const composition: Block[] = [
      block({
        id: "b1",
        key: "columns",
        areas: [{ key: "middle", blocks: [] }],
      }),
    ];

    const result = validateComposition(composition, resolveDefinition);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toMatchObject({ code: "cms.composition.unknown_area" });
    }
  });

  it("rejects a leaf block with areas", () => {
    const composition: Block[] = [
      block({ id: "b1", key: "text", areas: [{ key: "left", blocks: [] }] }),
    ];

    const result = validateComposition(composition, resolveDefinition);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toMatchObject({ code: "cms.composition.leaf_with_areas" });
    }
  });

  it("rejects composition deeper than the max depth", () => {
    function nest(depth: number): Block {
      if (depth === 0) {
        return block({ id: `leaf-${depth}`, key: "text" });
      }
      return block({
        id: `columns-${depth}`,
        key: "columns",
        areas: [{ key: "left", blocks: [nest(depth - 1)] }],
      });
    }

    const composition: Block[] = [nest(7)];

    const result = validateComposition(composition, resolveDefinition, { maxDepth: 6 });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toMatchObject({ code: "cms.composition.max_depth_exceeded" });
    }
  });

  it("respects a custom maxDepth within limits", () => {
    const composition: Block[] = [
      block({
        id: "b1",
        key: "columns",
        areas: [{ key: "left", blocks: [block({ id: "b2", key: "text" })] }],
      }),
    ];

    expect(validateComposition(composition, resolveDefinition, { maxDepth: 2 })).toEqual({ valid: true });
  });
});
