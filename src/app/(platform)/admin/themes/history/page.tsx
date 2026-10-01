import { getSettingsPageData } from "@/platform/admin-shell/get-settings-page-data";
import { ThemesTabs } from "../_layout/themes-tabs";
import { ThemesAccessDenied, ThemesTabPlaceholder } from "../_layout/themes-access-denied";

// /admin/themes/history (spec v8 §9). Dono:  as últimas 20 publicações da aparência, com autor, data e restauração.:W6. Stub da Fase F: só o gate e as abas.
export default async function ThemesHistoryPage() {
  const gate = await getSettingsPageData();
  if (!gate.granted) return <ThemesAccessDenied />;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-foreground">Histórico</h1>
      <ThemesTabs current="history" />
      <ThemesTabPlaceholder title="Histórico de publicações" description="Em breve" />
    </div>
  );
}
