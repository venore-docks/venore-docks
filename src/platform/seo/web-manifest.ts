import type { MetadataRoute } from "next";
import { getBrandConfig } from "@/platform/brand/get-brand-config";

// Cor de chrome escura, combinando com o wordmark branco da marca (= viewport.themeColor).
export const CHROME_DARK = "#171717";

// Web App Manifest (spec §7.7). Dono: W4 (cores do tema derivadas de tokens, ícones do tema) e W8
// (lang/dir do locale). Na Fase F: os valores de hoje, movidos de app/manifest.ts sem mudança.
export async function buildWebManifest(): Promise<MetadataRoute.Manifest> {
  const { siteName } = await getBrandConfig();

  return {
    name: siteName,
    short_name: siteName,
    description: siteName,
    lang: "pt-BR",
    dir: "ltr",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: CHROME_DARK,
    theme_color: CHROME_DARK,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
