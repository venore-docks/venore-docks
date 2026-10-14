import type { ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Block } from "@/contexts/cms";
import type { ThemeBlockRendererProps } from "@/contexts/themes/contracts/v8";

vi.mock("server-only", () => ({}));
// Independente dos @venore/plugin-* instalados no branch (só o core/tema está em teste aqui).
vi.mock("@/plugins/registry.generated", () => ({ PLUGIN_REGISTRY: [] }));
vi.mock("@/plugins/contributions.generated", () => ({ PLUGIN_CONTRIBUTIONS: {} }));
vi.mock("@/plugins/route-registry.generated", () => ({ PLUGIN_ROUTE_TABLES: {} }));
vi.mock("@/plugins/plugin-barrels.generated", () => ({ PLUGIN_BARRELS: {} }));
vi.mock("@/contexts/media", () => ({ getMediaAsset: async () => ({ success: false, error: { code: "t", message: "t" } }) }));
vi.mock("@/contexts/cms", async () => ({
  isBlockConfigured: (await import("@/contexts/cms/contracts/block-config")).isBlockConfigured,
}));
vi.mock("@/platform/plugin-engine/get-active-plugin-keys", () => ({ getActivePluginKeys: async () => new Set<string>() }));
vi.mock("@/platform/page-builder/page-layout-marker", () => ({ PageLayoutMarker: () => <span data-marker="" /> }));
vi.mock("@/platform/theme-rendering/document-model", () => ({ resolveDocumentModel: async () => ({ theme: { key: "alpha" } }) }));

// Tema "alpha": variante "poster" do heading embrulha o core (recebe Default) e declara o estilo
// de seção extra "glass". O tema "plain" não declara nada.
async function PosterHeading({ Default, variant, ...props }: ThemeBlockRendererProps) {
  return (
    <div data-theme-variant={variant}>
      <Default {...props} />
    </div>
  );
}
const pageBuilders = {
  alpha: { blockVariants: {}, sectionStyles: [{ value: "glass", label: "Vidro" }], hideSectionStyles: [] },
  plain: { blockVariants: {}, sectionStyles: [], hideSectionStyles: [] },
};
vi.mock("@/platform/theme-rendering/resolve-theme-definition", () => ({
  resolveThemeDefinition: (key: string) => ({
    theme: {
      key,
      pageBuilder: pageBuilders[key as keyof typeof pageBuilders],
      blockRenderers: async () => (key === "alpha" ? { "core.content.heading": { poster: PosterHeading } } : {}),
    },
    fallback: null,
  }),
}));

const { BlockRenderer } = await import("./block-renderer");
const { resetThemeBlockRenderersCacheForTests } = await import("@/platform/page-builder/theme-block-renderers");

async function html(node: ReactNode): Promise<string> {
  const stream = await renderToReadableStream(node, { onError: () => {} });
  await stream.allReady;
  return new Response(stream).text();
}

function block(key: string, data: Record<string, unknown>, areas: Block["areas"] = []): Block {
  return { id: `b-${key}-${JSON.stringify(data).length}`, key, slot: "root", htmlId: null, data, areas } as Block;
}
const heading = (data: Record<string, unknown>) => block("core.content.heading", { level: 2, text: "Olá", ...data });

describe("BlockRenderer — variantes e estilos de seção do tema", () => {
  beforeEach(() => resetThemeBlockRenderersCacheForTests());

  it("sem variante: renderer do core, com data-block na raiz", async () => {
    const out = await html(await BlockRenderer({ blocks: [heading({})], mode: "edit" }));
    expect(out).toContain('<h2 data-block="core.content.heading"');
    expect(out).not.toContain("data-theme-variant");
  });

  it("variante com renderer do tema: o tema renderiza e recebe o core como Default", async () => {
    const out = await html(await BlockRenderer({ blocks: [heading({ presentationVariant: "poster" })], mode: "edit" }));
    expect(out).toMatch(/<div data-theme-variant="poster"><h2 data-block="core.content.heading" data-block-variant="poster"[^>]*>Olá<\/h2><\/div>/);
  });

  it("variante desconhecida → core (marcada, sem renderer do tema)", async () => {
    const out = await html(await BlockRenderer({ blocks: [heading({ presentationVariant: "neon" })], mode: "edit" }));
    expect(out).not.toContain("data-theme-variant");
    expect(out).toContain('data-block-variant="neon"');
    expect(out).toContain(">Olá</h2>");
  });

  it("themeKey explícito (galeria/preview) usa os renderers daquele tema", async () => {
    const out = await html(await BlockRenderer({ blocks: [heading({ presentationVariant: "poster" })], mode: "edit", themeKey: "plain" }));
    expect(out).not.toContain("data-theme-variant");
  });

  it("estilo de seção: canônico e extra do tema emitem data-section-style e ganham do background", async () => {
    const section = (sectionStyle: string) =>
      block("core.layout.section", { background: "muted", maxWidth: "full", paddingY: "md", paddingX: "md", sectionStyle }, [
        { key: "content", blocks: [] },
      ] as never);
    const brand = await html(await BlockRenderer({ blocks: [section("brand")], mode: "edit" }));
    expect(brand).toMatch(/<section data-block="core.layout.section" data-section-style="brand" class="bg-background text-foreground/);
    expect(brand).not.toContain("bg-muted");
    const glass = await html(await BlockRenderer({ blocks: [section("glass")], mode: "edit" }));
    expect(glass).toContain('data-section-style="glass"');
  });

  it("estilo de seção desconhecido (ou extra de outro tema) → default: sem atributo, background legado vale", async () => {
    const section = block("core.layout.section", { background: "muted", sectionStyle: "glass" }, [{ key: "content", blocks: [] }] as never);
    const out = await html(await BlockRenderer({ blocks: [section], mode: "edit", themeKey: "plain" }));
    expect(out).not.toContain("data-section-style");
    expect(out).toContain("bg-muted");
  });

  it("modo publicado emite o marcador de layout da página uma vez", async () => {
    const out = await html(await BlockRenderer({ blocks: [heading({}), heading({ text: "b" })], mode: "published" }));
    expect(out.match(/data-marker/g)).toHaveLength(1);
    const edit = await html(await BlockRenderer({ blocks: [heading({})], mode: "edit" }));
    expect(edit).not.toContain("data-marker");
  });
});
