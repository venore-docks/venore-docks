import { describe, expect, it, vi } from "vitest";

// Imagens de identidade do site (/admin/settings/brand): o ícone do app (PWA) e a imagem de compartilhamento
// têm prioridade sobre o que o tema configura. Funções puras testadas com objetos simples — sem montar um
// tema inteiro (theme-seo.test.ts) e sem banco.
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/platform/theme-rendering/document-model", () => ({ resolveDocumentModel: async () => ({}) }));
vi.mock("@/platform/brand/get-brand-config", () => ({ getBrandConfig: async () => ({}) }));

const { DEFAULT_MANIFEST_ICONS, pickManifestIcons } = await import("./web-manifest");
const { pickDefaultOgImage } = await import("./og-image");

const noAssets = { assets: {} };
const mediaUrls = async (ids: string[]) => Object.fromEntries(ids.map((id) => [id, `/media/${id}.jpg`]));

describe("ícone do app (PWA)", () => {
  it("uma mídia só é declarada em 192 e 512 — sem os dois tamanhos o navegador não oferece instalar", () => {
    expect(pickManifestIcons(noAssets, "/media/app.png")).toEqual([
      { src: "/media/app.png", sizes: "192x192", purpose: "any" },
      { src: "/media/app.png", sizes: "512x512", purpose: "any" },
    ]);
  });

  it("sem ícone da identidade/config e sem assets do tema: os ícones padrão do core", () => {
    expect(pickManifestIcons(noAssets, null)).toEqual(DEFAULT_MANIFEST_ICONS);
  });

  it("assets do pacote do tema entram só quando não há mídia escolhida", () => {
    const themed = { assets: { icon192: { src: "/_next/a.png", width: 192, height: 192 } } };
    expect(pickManifestIcons(themed, null)).toEqual([{ src: "/_next/a.png", sizes: "192x192", type: "image/png", purpose: "any" }]);
    expect(pickManifestIcons(themed, "/media/app.png")).toHaveLength(2);
  });
});

describe("imagem de compartilhamento (Open Graph)", () => {
  const theme = { assets: { ogImage: { src: "/_next/og.png", width: 1200, height: 630 } } };

  it("a da identidade do site vence a da config do tema e a do pacote, sempre absoluta", async () => {
    const result = await pickDefaultOgImage({
      config: { assets: { ogImageMediaId: "m1" } },
      theme,
      origin: "https://s.test",
      brandUrl: "/media/marca.jpg",
      mediaUrls,
    });
    expect(result).toEqual([{ url: "https://s.test/media/marca.jpg" }]);
  });

  it("sem a da identidade (null ou ausente): config do tema → pacote → nenhuma, como antes", async () => {
    const withConfig = { config: { assets: { ogImageMediaId: "m1" } }, theme, origin: "https://s.test", mediaUrls };
    expect(await pickDefaultOgImage({ ...withConfig, brandUrl: null })).toEqual([{ url: "https://s.test/media/m1.jpg" }]);
    expect(await pickDefaultOgImage(withConfig)).toEqual([{ url: "https://s.test/media/m1.jpg" }]);
    expect(await pickDefaultOgImage({ config: { assets: {} }, theme, origin: "https://s.test", mediaUrls })).toEqual([
      { url: "https://s.test/_next/og.png", width: 1200, height: 630 },
    ]);
    expect(await pickDefaultOgImage({ config: { assets: {} }, theme: noAssets, origin: "https://s.test", mediaUrls })).toBeUndefined();
  });
});
