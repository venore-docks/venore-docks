import { getSettingsPageData } from "@/platform/admin-shell/get-settings-page-data";
import { loadThemeCustomizeData } from "@/platform/theme-engine/theme-config";
import { ThemesTabs } from "../_layout/themes-tabs";
import { ThemesAccessDenied } from "../_layout/themes-access-denied";
import { CustomizeWorkspace } from "./_components/customize-workspace";

// /admin/themes/customize — painéis à esquerda, preview (iframe do próprio site) à direita (spec
// v8 §7.2). Edições de cor/opção vão na hora para o iframe via PreviewBridge; estruturais salvam o
// rascunho e recarregam. Nada aqui publica sozinho.
export default async function ThemesCustomizePage() {
  const gate = await getSettingsPageData();
  if (!gate.granted) return <ThemesAccessDenied />;

  const data = await loadThemeCustomizeData();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Personalizar</h1>
      <ThemesTabs current="customize" />
      {data.success ? (
        <CustomizeWorkspace
          initialDocument={data.data.document}
          draft={data.data.draft}
          storageUnavailable={data.data.storageUnavailable}
          themes={data.data.themes}
          theme={data.data.theme}
        />
      ) : (
        <p role="alert" className="text-sm text-destructive">
          {data.error.message}
        </p>
      )}
    </div>
  );
}
