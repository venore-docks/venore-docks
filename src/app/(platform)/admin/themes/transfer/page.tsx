import { getSettingsPageData } from "@/platform/admin-shell/get-settings-page-data";
import { ThemesTabs } from "../_layout/themes-tabs";
import { ThemesAccessDenied } from "../_layout/themes-access-denied";
import { ImportConfigForm } from "./_components/import-config-form";

// /admin/themes/transfer (spec v8 §7.10): exportar a configuração de aparência publicada como
// arquivo e importar um arquivo como rascunho.
export default async function ThemesTransferPage() {
  const gate = await getSettingsPageData();
  if (!gate.granted) return <ThemesAccessDenied />;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-foreground">Transferir</h1>
      <ThemesTabs current="transfer" />
      <section className="space-y-2 rounded-panel border border-border bg-card ui-panel-padding-roomy">
        <h2 className="text-sm font-semibold text-foreground">Exportar</h2>
        <p className="text-sm text-muted-foreground">
          Baixa a configuração publicada (tema, paleta, opções, fontes, seções e imagens escolhidas) num arquivo JSON.
        </p>
        <a
          href="/api/themes/config/export"
          download
          className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-sm text-foreground outline-none ui-motion-base hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          Baixar configuração
        </a>
      </section>
      <section className="space-y-2 rounded-panel border border-border bg-card ui-panel-padding-roomy">
        <h2 className="text-sm font-semibold text-foreground">Importar</h2>
        <p className="text-sm text-muted-foreground">
          O arquivo vira um rascunho: nada muda no site até você publicar. Opções, paletas ou temas que não existem aqui são descartados com aviso.
        </p>
        <ImportConfigForm />
      </section>
    </div>
  );
}
