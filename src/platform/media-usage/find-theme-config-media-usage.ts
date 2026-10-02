import { getPublishedThemeConfig, getThemeDraft } from "@/contexts/themes";
import type { ThemeConfigDocument } from "@/contexts/themes/contracts/v8";
import type { MediaUsageReference } from "./types";

const ASSET_LABELS: Record<keyof ThemeConfigDocument["assets"], string> = {
  ogImageMediaId: "Imagem de compartilhamento (Open Graph)",
  iconMediaId: "Ícone do site",
};

// Referências de mídia dentro de um documento de config do tema: assets (OG, ícone) e valores de
// opção (opção `media` guarda o id) por tema e por seção.
export function findMediaInThemeConfig(config: ThemeConfigDocument, mediaId: string, scope: string): MediaUsageReference[] {
  const references: MediaUsageReference[] = [];
  const push = (label: string) =>
    references.push({ consumerKey: "themes", consumerLabel: "Tema", label: `${label} (${scope})`, href: "/admin/themes/customize" });

  for (const [key, label] of Object.entries(ASSET_LABELS) as [keyof ThemeConfigDocument["assets"], string][]) {
    if (config.assets?.[key] === mediaId) push(label);
  }
  for (const [themeKey, entry] of Object.entries(config.byTheme ?? {})) {
    for (const [optionKey, value] of Object.entries(entry.options ?? {})) {
      if (value === mediaId) push(`Opção "${optionKey}" do tema ${themeKey}`);
    }
  }
  for (const section of config.sections ?? []) {
    for (const [optionKey, value] of Object.entries(section.options ?? {})) {
      if (value === mediaId) push(`Opção "${optionKey}" da seção ${section.label}`);
    }
  }
  return references;
}

// Provider de uso de mídia da config do tema (spec §7.6): config publicada e, quando quem consulta
// pode ver (settings.manage), o rascunho — apagar uma mídia usada só no rascunho quebraria a
// publicação seguinte. Config sintetizada do legado não tem assets nem opções de mídia.
export async function findThemeConfigMediaUsage(mediaId: string): Promise<MediaUsageReference[]> {
  const [published, draft] = await Promise.all([getPublishedThemeConfig(), getThemeDraft().catch(() => null)]);
  const references: MediaUsageReference[] = [];
  if (published.success) references.push(...findMediaInThemeConfig(published.data, mediaId, "publicado"));
  if (draft?.success && draft.data) references.push(...findMediaInThemeConfig(draft.data.config, mediaId, "rascunho"));
  return references;
}
