import { getSettingsPageData } from "@/platform/admin-shell/get-settings-page-data";
import { ThemesTabs } from "../_layout/themes-tabs";
import { ThemesAccessDenied, ThemesTabPlaceholder } from "../_layout/themes-access-denied";

// /admin/themes/customize — painéis à esquerda, preview (iframe) à direita (spec v8 §7.2). Dono:
// W6. Stub da Fase F: só o gate e as abas.
export default async function ThemesCustomizePage() {
  const gate = await getSettingsPageData();
  if (!gate.granted) return <ThemesAccessDenied />;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-foreground">Personalizar</h1>
      <ThemesTabs current="customize" />
      <ThemesTabPlaceholder
        title="Personalização com rascunho"
        description="Em breve: editar tema, paleta, opções, fontes e seções num rascunho, com pré-visualização antes de publicar."
      />
    </div>
  );
}
