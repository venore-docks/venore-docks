import { getSettingsPageData } from "@/platform/admin-shell/get-settings-page-data";
import { ThemesTabs } from "../_layout/themes-tabs";
import { ThemesAccessDenied, ThemesTabPlaceholder } from "../_layout/themes-access-denied";

// /admin/themes/gallery (spec v8 §9). Dono:  todas as regiões, templates, estados e blocos de qualquer tema instalado, sem ativá-lo.:W10. Stub da Fase F: só o gate e as abas.
export default async function ThemesGalleryPage() {
  const gate = await getSettingsPageData();
  if (!gate.granted) return <ThemesAccessDenied />;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-foreground">Galeria</h1>
      <ThemesTabs current="gallery" />
      <ThemesTabPlaceholder title="Galeria de temas" description="Em breve" />
    </div>
  );
}
