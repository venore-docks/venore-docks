import { getMediaAsset } from "@/contexts/media";
import { getSetting } from "@/contexts/settings";
import { BRAND_SETTING_KEYS } from "./get-brand-config";

export type BrandMediaSelection = { id: string; filename: string; url: string; contentType: string } | null;

export type BrandMediaSelections = {
  logo: BrandMediaSelection;
  logoScrolled: BrandMediaSelection;
  favicon: BrandMediaSelection;
  pwaIcon: BrandMediaSelection;
  ogImage: BrandMediaSelection;
};

async function resolveSelection(key: string): Promise<BrandMediaSelection> {
  const setting = await getSetting({ key });
  if (!setting.success || !setting.data || typeof setting.data.value !== "string" || !setting.data.value) {
    return null;
  }

  const media = await getMediaAsset({ id: setting.data.value });
  if (!media.success || !media.data) {
    return null;
  }

  return { id: media.data.id, filename: media.data.filename, url: media.data.url, contentType: media.data.contentType };
}

// Só pro form de admin (/admin/settings/brand) montar o `initialMedia` do MediaPickerField —
// getBrandConfig() já resolve pra URL final (caminho quente do header), este aqui resolve pro
// registro completo que o picker precisa pra exibir a seleção atual.
export async function getBrandMediaSelections(): Promise<BrandMediaSelections> {
  const [logo, logoScrolled, favicon, pwaIcon, ogImage] = await Promise.all([
    resolveSelection(BRAND_SETTING_KEYS.logoMediaId),
    resolveSelection(BRAND_SETTING_KEYS.logoScrolledMediaId),
    resolveSelection(BRAND_SETTING_KEYS.faviconMediaId),
    resolveSelection(BRAND_SETTING_KEYS.pwaIconMediaId),
    resolveSelection(BRAND_SETTING_KEYS.ogImageMediaId),
  ]);

  return { logo, logoScrolled, favicon, pwaIcon, ogImage };
}
