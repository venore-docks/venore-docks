import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BlockRendererProps } from "./block-renderers";

vi.mock("server-only", () => ({}));
vi.mock("@/contexts/media", () => ({ getMediaAsset: async () => ({ success: false, error: { code: "t", message: "t" } }) }));

// Dois temas no MESMO processo, cada um com loader preguiçoso contado.
const HeroPoster = (props: BlockRendererProps) => props.block.id;
const HeroSplit = (props: BlockRendererProps) => props.block.id;
const loaders = {
  alpha: vi.fn(async () => ({ "core.content.hero": { poster: HeroPoster, default: HeroSplit, broken: "nope" } })),
  beta: vi.fn(async () => ({ "core.content.hero": { split: HeroSplit } })),
  crash: vi.fn(async () => {
    throw new Error("loader quebrado");
  }),
};
vi.mock("@/platform/theme-rendering/resolve-theme-definition", () => ({
  resolveThemeDefinition: (key: string) =>
    key in loaders
      ? { theme: { key, blockRenderers: loaders[key as keyof typeof loaders] }, fallback: null }
      : { theme: { key: "venore-slime", blockRenderers: async () => ({}) }, fallback: { reason: "missing-theme", requestedKey: key } },
}));

const { loadThemeBlockRenderers, resetThemeBlockRenderersCacheForTests } = await import("./theme-block-renderers");
const { resolveBlockRenderer, listBlockRendererKeys } = await import("./block-renderers");

describe("loadThemeBlockRenderers", () => {
  beforeEach(() => {
    resetThemeBlockRenderersCacheForTests();
    for (const loader of Object.values(loaders)) loader.mockClear();
  });

  it("sem tema → mapa vazio, sem carregar nada", async () => {
    expect(await loadThemeBlockRenderers()).toEqual({});
    expect(loaders.alpha).not.toHaveBeenCalled();
  });

  it("memoiza por theme key (um import por tema por processo) e mantém os mapas separados", async () => {
    const [a1, b1, a2] = await Promise.all([loadThemeBlockRenderers("alpha"), loadThemeBlockRenderers("beta"), loadThemeBlockRenderers("alpha")]);
    expect(a1).toBe(a2);
    expect(loaders.alpha).toHaveBeenCalledTimes(1);
    expect(loaders.beta).toHaveBeenCalledTimes(1);
    // "default" nunca é variante do tema (é o core) e valor que não é componente é descartado.
    expect(Object.keys(a1["core.content.hero"])).toEqual(["poster"]);
    expect(Object.keys(b1["core.content.hero"])).toEqual(["split"]);
  });

  it("não contamina o cachedRenderers do core (paridade registry ↔ renderers continua)", async () => {
    const before = await resolveBlockRenderer("core.content.hero");
    const keysBefore = await listBlockRendererKeys();
    await loadThemeBlockRenderers("alpha");
    await loadThemeBlockRenderers("beta");
    expect(await resolveBlockRenderer("core.content.hero")).toBe(before);
    expect(before).not.toBe(HeroPoster);
    expect(await listBlockRendererKeys()).toEqual(keysBefore);
  });

  it("tema desconhecido (fallback) → vazio; loader que lança → vazio e não memoiza a falha", async () => {
    expect(await loadThemeBlockRenderers("ghost")).toEqual({});
    expect(await loadThemeBlockRenderers("crash")).toEqual({});
    expect(await loadThemeBlockRenderers("crash")).toEqual({});
    expect(loaders.crash).toHaveBeenCalledTimes(2);
  });
});
