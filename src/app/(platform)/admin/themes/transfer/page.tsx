import { getSettingsPageData } from "@/platform/admin-shell/get-settings-page-data";
import { ThemesTabs } from "../_layout/themes-tabs";
import { ThemesAccessDenied, ThemesTabPlaceholder } from "../_layout/themes-access-denied";

// /admin/themes/transfer (spec v8 §9). Dono:  exportar a configuração de aparência como arquivo e importar como rascunho.:W6. Stub da Fase F: só o gate e as abas.
export default async function ThemesTransferPage() {
  const gate = await getSettingsPageData();
  if (!gate.granted) return <ThemesAccessDenied />;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-foreground">Transferir</h1>
      <ThemesTabs current="transfer" />
      <ThemesTabPlaceholder title="Exportar e importar" description="Em breve" />
    </div>
  );
}
