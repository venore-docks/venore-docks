import { describe, expect, it, vi } from "vitest";
import { CANONICAL_SECTION_STYLES } from "@/contexts/themes/contracts/v8";
import { resolveThemeDefinition } from "@/platform/theme-rendering/resolve-theme-definition";
import { buildGalleryBlockSamples, buildGalleryModel, gallerySearch, GALLERY_SCOPE, parseGallerySelection } from "./gallery-model";

vi.mock("next/font/google", async () => (await import("@/test-support/themes/next-font-google-mock")).nextFontGoogleMock());

describe("parseGallerySelection", () => {
  it("tema fora do registro cai no ativo; sem ativo, no venore-slime", () => {
    expect(parseGallerySelection({ theme: "nao-existe" }, "aurora").themeKey).toBe("aurora");
    expect(parseGallerySelection({}, null).themeKey).toBe("venore-slime");
    expect(parseGallerySelection({ theme: ["nite", "aurora"] }, null).themeKey).toBe("nite");
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
    const model = buildGalleryModel({ selection: { themeKey: "aurora", mode: "dark", locale: "pt-BR", dir: "ltr" } });
    expect(model.theme.key).toBe("aurora");
    expect(model.rootAttributes).toMatchObject({ "data-gallery-root": "", "data-theme": "aurora", dir: "ltr", lang: "pt-BR" });
    expect(model.rootClassName.split(" ")).toContain("dark");
    expect(model.scopedCss).not.toContain("html[");
    if (model.scopedCss) expect(model.scopedCss).toContain(GALLERY_SCOPE);
    expect(model.contrast).toHaveLength(10);
    expect(model.tokens.some((token) => token.name === "background")).toBe(true);
  });

  it("tema desabilitado ⇒ fallback com diagnóstico", () => {
    const model = buildGalleryModel({ selection: { themeKey: "nite", mode: "light", locale: "pt-BR", dir: "ltr" }, isEnabled: () => false });
    expect(model.theme.key).toBe("venore-slime");
    expect(model.fallback).toEqual({ reason: "disabled", requestedKey: "nite" });
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
