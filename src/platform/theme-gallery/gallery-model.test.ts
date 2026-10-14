import { describe, expect, it, vi } from "vitest";
import { CANONICAL_SECTION_STYLES } from "@/contexts/themes/contracts/v8";
import { resolveThemeDefinition } from "@/platform/theme-rendering/resolve-theme-definition";
import { buildGalleryBlockSamples, buildGalleryModel, gallerySearch, GALLERY_SCOPE, parseGallerySelection } from "./gallery-model";

// Temas além do venore-slime vêm das fixtures do repo (v8 pai/filho e um 7.x), não dos pacotes
// @venore/theme-* instalados no branch.
vi.mock("@/themes/registry.generated", async () => ({
  GENERATED_THEME_REGISTRY: (await import("@/test-support/themes/fixture-registry")).FIXTURE_THEME_REGISTRY,
}));
vi.mock("@/themes/theme-tokens.generated", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/themes/theme-tokens.generated")>();
  const { withFixtureThemeTokens } = await import("@/test-support/themes/fixture-tokens");
  return { ...real, THEME_TOKEN_VALUES: withFixtureThemeTokens(real.THEME_TOKEN_VALUES) };
});
vi.mock("next/font/google", async () => (await import("@/test-support/themes/next-font-google-mock")).nextFontGoogleMock());

describe("parseGallerySelection", () => {
  it("tema fora do registro cai no ativo; sem ativo, no venore-slime", () => {
    expect(parseGallerySelection({ theme: "nao-existe" }, "fixture-parent").themeKey).toBe("fixture-parent");
    expect(parseGallerySelection({}, null).themeKey).toBe("venore-slime");
    expect(parseGallerySelection({ theme: ["fixture-legacy", "fixture-parent"] }, null).themeKey).toBe("fixture-legacy");
  });

  it("modo só entre os colorModes do tema; locale só dos catálogos; dir segue o idioma", () => {
    expect(parseGallerySelection({ theme: "venore-slime", mode: "dark" }, null).mode).toBe("dark");
    expect(parseGallerySelection({ theme: "venore-slime", mode: "sépia" }, null).mode).toBe("light");
    expect(parseGallerySelection({ locale: "xx-YY" }, null).locale).toBe("pt-BR");
    expect(parseGallerySelection({ locale: "ar" }, null).dir).toBe("rtl");
    expect(parseGallerySelection({ locale: "ar", dir: "ltr" }, null).dir).toBe("ltr");
  });

  it("gallerySearch serializa a seleção com o patch", () => {
    const selection = parseGallerySelection({ theme: "venore-slime" }, null);
    expect(gallerySearch(selection, { mode: "dark" })).toBe("?theme=venore-slime&mode=dark&locale=pt-BR&dir=ltr");
  });
});

describe("buildGalleryModel", () => {
  it("raiz com data-theme do tema pedido e CSS de runtime só com o escopo da galeria", () => {
    const model = buildGalleryModel({ selection: { themeKey: "fixture-parent", mode: "dark", locale: "pt-BR", dir: "ltr" } });
    expect(model.theme.key).toBe("fixture-parent");
    expect(model.rootAttributes).toMatchObject({ "data-gallery-root": "", "data-theme": "fixture-parent", dir: "ltr", lang: "pt-BR" });
    expect(model.rootClassName.split(" ")).toContain("dark");
    expect(model.scopedCss).not.toContain("html[");
    if (model.scopedCss) expect(model.scopedCss).toContain(GALLERY_SCOPE);
    expect(model.contrast).toHaveLength(10);
    expect(model.tokens.some((token) => token.name === "background")).toBe(true);
  });

  it("tema desabilitado ⇒ fallback com diagnóstico", () => {
    const model = buildGalleryModel({ selection: { themeKey: "fixture-legacy", mode: "light", locale: "pt-BR", dir: "ltr" }, isEnabled: () => false });
    expect(model.theme.key).toBe("venore-slime");
    expect(model.fallback).toEqual({ reason: "disabled", requestedKey: "fixture-legacy" });
  });
});

describe("buildGalleryBlockSamples", () => {
  it("todo bloco folha do core, cada variante declarada pelo tema e cada estilo de seção", () => {
    const { theme } = resolveThemeDefinition("venore-slime");
    const withVariants = {
      ...theme,
      pageBuilder: {
        ...theme.pageBuilder,
        blockVariants: { "core.content.heading": [{ value: "eyebrow", label: "Com sobretítulo" }] },
        sectionStyles: [{ value: "glass", label: "Vidro" }],
      },
    };
    const samples = buildGalleryBlockSamples(withVariants, "pt-BR");
    expect(samples.some((sample) => sample.id === "core.content.heading")).toBe(true);
    const variant = samples.find((sample) => sample.variant === "eyebrow");
    expect(variant?.blocks[0].data.presentationVariant).toBe("eyebrow");
    const styles = samples.filter((sample) => sample.sectionStyle).map((sample) => sample.sectionStyle);
    expect(styles).toEqual(expect.arrayContaining([...CANONICAL_SECTION_STYLES, "glass"]));
    expect(new Set(samples.flatMap((sample) => sample.blocks.map((block) => block.id))).size).toBe(samples.length);
  });
});
