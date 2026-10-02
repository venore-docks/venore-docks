import { getSettingsPageData } from "@/platform/admin-shell/get-settings-page-data";
import { buildGalleryModel, parseGallerySelection, type GallerySearchParams } from "@/platform/theme-gallery/gallery-model";
import { listThemeStates } from "@/platform/theme-engine/list-theme-states";
import { ThemesTabs } from "../_layout/themes-tabs";
import { ThemesAccessDenied } from "../_layout/themes-access-denied";
import { ThemeGallery } from "./_components/theme-gallery";

// /admin/themes/gallery?theme=&mode=&locale=&dir= (spec v8 §7.13, W10). Galeria viva: regiões,
// layouts em 390/1280, templates, estados, blocos com variantes e estilos de seção, tokens com
// contraste por região e opções — de qualquer tema do registro, SEM ativá-lo (só leitura: nada de
// settings, nada de cookie). Gate: settings.manage (getSettingsPageData).
export default async function ThemesGalleryPage({ searchParams }: { searchParams: Promise<GallerySearchParams> }) {
  const gate = await getSettingsPageData();
  if (!gate.granted) return <ThemesAccessDenied />;

  const themes = await listThemeStates();
  const active = themes.find((state) => state.isActive)?.manifest.key ?? null;
  const enabled = new Map(themes.map((state) => [state.manifest.key, state.enabled]));
  const selection = parseGallerySelection(await searchParams, active);
  // Desabilitado ⇒ fallback com aviso, como o render faria (foundation-notes, desvio 9).
  const gallery = buildGalleryModel({ selection, isEnabled: (key) => enabled.get(key) ?? true });

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-foreground">Galeria</h1>
      <ThemesTabs current="gallery" />
      <ThemeGallery gallery={gallery} themes={themes} />
    </div>
  );
}
