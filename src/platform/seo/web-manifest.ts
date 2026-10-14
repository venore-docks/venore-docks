import type { MetadataRoute } from "next";
import { getMediaAssetUrls } from "@/contexts/media";
import type { ResolvedThemeDefinition, ThemeConfigDocument } from "@/contexts/themes/contracts/v8";
import { getBrandConfig } from "@/platform/brand/get-brand-config";
import { resolveDocumentModel } from "@/platform/theme-rendering/document-model";
import { resolveThemeChromeColors, type ThemeChromeColors } from "./theme-color";
import { documentPaletteChoice } from "./viewport";

export { CHROME_DARK } from "./theme-color";

type ManifestIcon = NonNullable<MetadataRoute.Manifest["icons"]>[number];

export const DEFAULT_MANIFEST_ICONS: ManifestIcon[] = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

// Ícones do PWA (spec §7.7): mídia da config do tema (config.assets.iconMediaId) → assets do
// pacote (icon192/icon512/maskable512) → os ícones do core de hoje.
export function pickManifestIcons(
  theme: Pick<ResolvedThemeDefinition, "assets">,
  configIconUrl: string | null,
): ManifestIcon[] {
  if (configIconUrl) return [{ src: configIconUrl, sizes: "any", purpose: "any" }];
  const { icon192, icon512, maskable512 } = theme.assets;
  if (!icon192 && !icon512 && !maskable512) return DEFAULT_MANIFEST_ICONS;
  const icon = (src: { src: string; width: number; height: number }, purpose: "any" | "maskable"): ManifestIcon => ({
    src: src.src,
    sizes: `${src.width}x${src.height}`,
    type: "image/png",
    purpose,
  });
  const icons: ManifestIcon[] = [];
  if (icon192) icons.push(icon(icon192, "any"));
  if (icon512) icons.push(icon(icon512, "any"));
  if (maskable512) icons.push(icon(maskable512, "maskable"));
  return icons;
}

export function composeWebManifest(input: {
  siteName: string;
  colors: ThemeChromeColors;
  icons: ManifestIcon[];
  locale: string;
  dir: "ltr" | "rtl";
}): MetadataRoute.Manifest {
  return {
    name: input.siteName,
    short_name: input.siteName,
    description: input.siteName,
    lang: input.locale,
    dir: input.dir,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Splash e barra do app com a mesma cor de chrome do viewport (modo claro: o manifest só tem
    // uma cor).
    background_color: input.colors.light,
    theme_color: input.colors.light,
    icons: input.icons,
  };
}

async function configIconUrl(config: Pick<ThemeConfigDocument, "assets">): Promise<string | null> {
  const id = config.assets?.iconMediaId;
  if (!id) return null;
  const result = await getMediaAssetUrls({ ids: [id] });
  return result.success ? (result.data[id] ?? null) : null;
}

// Web App Manifest (spec §7.7): cores e ícones do tema (W4), lang/dir do locale do documento (W8).
export async function buildWebManifest(): Promise<MetadataRoute.Manifest> {
  const [{ siteName }, doc] = await Promise.all([getBrandConfig(), resolveDocumentModel()]);
  return composeWebManifest({
    siteName,
    colors: resolveThemeChromeColors(doc.theme, documentPaletteChoice(doc)),
    icons: pickManifestIcons(doc.theme, await configIconUrl(doc.config)),
    locale: doc.locale,
    dir: doc.dir,
  });
}
