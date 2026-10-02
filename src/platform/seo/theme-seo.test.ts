import { describe, expect, it, vi } from "vitest";
import type { ColorPalette } from "@/contexts/themes/contracts/types";
import { venoreSlimeTheme } from "@/themes/venore-slime/theme";
import { normalizeThemeDefinition } from "@/platform/theme-rendering/normalize-entry";

// SEO do tema (spec v8 §7.7, W4): themeColor (header primeiro; slime = #171717), manifest com
// cores/ícones do tema e lang/dir do documento, imagem padrão de Open Graph.
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/platform/theme-rendering/document-model", () => ({ resolveDocumentModel: async () => ({}) }));

const { CHROME_DARK, colorToHex, resolveThemeChromeColors } = await import("./theme-color");
const { buildViewport } = await import("./viewport");
const { composeWebManifest, DEFAULT_MANIFEST_ICONS, pickManifestIcons } = await import("./web-manifest");
const { pickDefaultOgImage } = await import("./og-image");

const slime = normalizeThemeDefinition("venore-slime", venoreSlimeTheme, ["venore-slime"]);
const withSeo = (seo: (typeof slime)["seo"], colorPalettes: ColorPalette[] = []) => ({ ...slime, key: "t", seo, colorPalettes });
const image = (src: string, size: number) => ({ src, width: size, height: size });

describe("themeColor", () => {
  it("venore-slime continua #171717 (claro e escuro) e o viewport sai como antes", () => {
    expect(resolveThemeChromeColors(slime)).toEqual({ light: "#171717", dark: "#171717" });
    expect(buildViewport(resolveThemeChromeColors(slime))).toEqual({
      width: "device-width",
      initialScale: 1,
      viewportFit: "cover",
      themeColor: "#171717",
    });
  });

  it("from-tokens: --header-bg primeiro, --background só sem header", () => {
    const tokens = {
      t: {
        light: { "--header-bg": "#112233", "--background": "#ffffff" },
        dark: { "--background": "oklch(0 0 0)" },
      },
    };
    expect(resolveThemeChromeColors(withSeo({ themeColor: "from-tokens" }), undefined, tokens)).toEqual({ light: "#112233", dark: "#000000" });
    const viewport = buildViewport({ light: "#112233", dark: "#000000" });
    expect(viewport.themeColor).toEqual([
      { media: "(prefers-color-scheme: light)", color: "#112233" },
      { media: "(prefers-color-scheme: dark)", color: "#000000" },
    ]);
  });

  it("from-tokens: a paleta ativa vence os tokens; sem nada resolvível, CHROME_DARK", () => {
    const palette: ColorPalette = { id: "p", name: "P", light: { background: "#abcdef" }, dark: {} };
    const theme = withSeo({ themeColor: "from-tokens" }, [palette]);
    expect(resolveThemeChromeColors(theme, { mode: "preset", presetId: "p" }, { t: { light: { "--header-bg": "#112233" }, dark: {} } })).toEqual({
      light: "#abcdef",
      dark: CHROME_DARK,
    });
    expect(resolveThemeChromeColors(theme, undefined, {})).toEqual({ light: CHROME_DARK, dark: CHROME_DARK });
  });

  it("valor explícito do tema; cor não-resolvível vira CHROME_DARK", () => {
    expect(resolveThemeChromeColors(withSeo({ themeColor: { light: "#FFFFFF", dark: "var(--x)" } }))).toEqual({ light: "#ffffff", dark: CHROME_DARK });
    expect(colorToHex("color-mix(in oklch, red, blue)")).toBeNull();
    expect(colorToHex("oklch(1 0 0)")).toBe("#ffffff");
  });
});

describe("web manifest", () => {
  it("cores do tema e lang/dir do documento", () => {
    const manifest = composeWebManifest({
      siteName: "S",
      colors: { light: "#123456", dark: "#000000" },
      icons: DEFAULT_MANIFEST_ICONS,
      locale: "ar",
      dir: "rtl",
    });
    expect(manifest).toMatchObject({ name: "S", lang: "ar", dir: "rtl", theme_color: "#123456", background_color: "#123456" });
  });

  it("ícones: mídia da config → assets do tema → os do core", () => {
    expect(pickManifestIcons(slime, null)).toEqual(DEFAULT_MANIFEST_ICONS);
    expect(pickManifestIcons(slime, "/media/i.png")).toEqual([{ src: "/media/i.png", sizes: "any", purpose: "any" }]);
    const themed = { assets: { icon192: image("/_next/a.png", 192), maskable512: image("/_next/m.png", 512) } };
    expect(pickManifestIcons(themed, null)).toEqual([
      { src: "/_next/a.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/_next/m.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ]);
  });
});

describe("imagem padrão de Open Graph", () => {
  const mediaUrls = async (ids: string[]) => Object.fromEntries(ids.map((id) => [id, `/media/${id}.jpg`]));

  it("config.assets.ogImageMediaId → asset do tema → nenhuma, sempre absoluta", async () => {
    const theme = { assets: { ogImage: image("/_next/og.png", 1200) } };
    expect(await pickDefaultOgImage({ config: { assets: { ogImageMediaId: "m1" } }, theme, origin: "https://s.test", mediaUrls })).toEqual([
      { url: "https://s.test/media/m1.jpg" },
    ]);
    expect(await pickDefaultOgImage({ config: { assets: {} }, theme, origin: "https://s.test", mediaUrls })).toEqual([
      { url: "https://s.test/_next/og.png", width: 1200, height: 1200 },
    ]);
    expect(await pickDefaultOgImage({ config: { assets: {} }, theme: { assets: {} }, origin: "https://s.test", mediaUrls })).toBeUndefined();
  });
});
