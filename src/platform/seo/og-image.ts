import { cache } from "react";
import { getMediaAssetUrls } from "@/contexts/media";
import type { ResolvedThemeDefinition, ThemeConfigDocument } from "@/contexts/themes/contracts/v8";
import { getBrandConfig } from "@/platform/brand/get-brand-config";
import { resolveDocumentModel } from "@/platform/theme-rendering/document-model";
import { getSiteOrigin } from "./site-origin";

export type OgImage = { url: string; width?: number; height?: number };

function absolute(url: string, origin: string): string {
  try {
    return new URL(url, origin).toString();
  } catch {
    return url;
  }
}

// Imagem padrão de compartilhamento (spec §7.7): imagem da identidade do site (/admin/settings/brand) →
// mídia escolhida na config do tema (config.assets.ogImageMediaId) → asset do pacote
// (definition.assets.ogImage) → nenhuma. URL
// absoluta a partir da origem do site (o crawler do WhatsApp/Facebook não resolve relativa).
export async function pickDefaultOgImage(input: {
  config: Pick<ThemeConfigDocument, "assets">;
  theme: Pick<ResolvedThemeDefinition, "assets">;
  origin: string;
  // URL já resolvida da imagem da identidade do site (null/ausente = não definida).
  brandUrl?: string | null;
  mediaUrls: (ids: string[]) => Promise<Record<string, string>>;
}): Promise<OgImage[] | undefined> {
  if (input.brandUrl) return [{ url: absolute(input.brandUrl, input.origin) }];
  const mediaId = input.config.assets?.ogImageMediaId;
  if (mediaId) {
    const url = (await input.mediaUrls([mediaId]))[mediaId];
    if (url) return [{ url: absolute(url, input.origin) }];
  }
  const asset = input.theme.assets.ogImage;
  if (asset?.src) return [{ url: absolute(asset.src, input.origin), width: asset.width, height: asset.height }];
  return undefined;
}

export const resolveDefaultOgImage = cache(async (): Promise<OgImage[] | undefined> => {
  const [doc, origin, brand] = await Promise.all([resolveDocumentModel(), getSiteOrigin(), getBrandConfig()]);
  return pickDefaultOgImage({
    config: doc.config,
    theme: doc.theme,
    origin,
    brandUrl: brand.ogImageUrl,
    mediaUrls: async (ids) => {
      const result = await getMediaAssetUrls({ ids });
      return result.success ? result.data : {};
    },
  });
});
