import { getSetting } from "@/contexts/settings";
import type { MediaUsageReference } from "@/platform/media-usage/types";
import { BRAND_SETTING_KEYS } from "./get-brand-config";

const FIELDS: { key: string; label: string }[] = [
  { key: BRAND_SETTING_KEYS.logoMediaId, label: "Logo do cabeçalho" },
  { key: BRAND_SETTING_KEYS.logoScrolledMediaId, label: "Logo (com scroll)" },
  { key: BRAND_SETTING_KEYS.faviconMediaId, label: "Favicon" },
  { key: BRAND_SETTING_KEYS.pwaIconMediaId, label: "Ícone do app (PWA)" },
  { key: BRAND_SETTING_KEYS.ogImageMediaId, label: "Imagem de compartilhamento" },
];

// Provider de uso de mídia do domínio brand (docs/venore-docks.md — regra 12/14): brand guarda
// mediaId como valor solto na tabela genérica de settings, não uma coluna própria, então cada
// campo é um lookup por chave — mesma lógica de is-media-referenced-by-brand.ts, agora devolvendo
// a referência completa (com link pra tela de edição) em vez de só um boolean, pro registro de
// uso em platform/media-usage/media-usage-registry.ts.
export async function findBrandMediaUsage(mediaId: string): Promise<MediaUsageReference[]> {
  const references: MediaUsageReference[] = [];

  for (const field of FIELDS) {
    const result = await getSetting({ key: field.key });
    if (result.success && result.data && result.data.value === mediaId) {
      references.push({
        consumerKey: "brand",
        consumerLabel: "Marca",
        label: field.label,
        href: "/admin/settings/brand",
      });
    }
  }

  return references;
}
