import { Badge } from "@/components/ui/badge";
import { getSettingsPageData } from "@/platform/admin-shell/get-settings-page-data";
import { loadThemeConfigHistory } from "@/platform/theme-engine/theme-config";
import { ThemesTabs } from "../_layout/themes-tabs";
import { ThemesAccessDenied, ThemesTabPlaceholder } from "../_layout/themes-access-denied";
import { RollbackButton } from "./_components/rollback-button";

const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

// /admin/themes/history (spec v8 §7.2): as últimas 20 publicações da aparência, com autor, data e
// restauração (rollback = nova publicação, com confirmação).
export default async function ThemesHistoryPage() {
  const gate = await getSettingsPageData();
  if (!gate.granted) return <ThemesAccessDenied />;

  const history = await loadThemeConfigHistory();

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-foreground">Histórico</h1>
      <ThemesTabs current="history" />
      {!history.success ? (
        <p role="alert" className="text-sm text-destructive">
          {history.error.message}
        </p>
      ) : history.data.storageUnavailable ? (
        <ThemesTabPlaceholder
          title="Histórico indisponível neste ambiente"
          description="A tabela de revisões ainda não existe aqui (migration pendente). O site continua normal."
        />
      ) : history.data.items.length === 0 ? (
        <ThemesTabPlaceholder
          title="Nenhuma publicação ainda"
          description="As publicações feitas em Personalizar aparecem aqui (as 20 mais recentes)."
        />
      ) : (
        <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
          <ul className="divide-y divide-border">
            {history.data.items.map((item) => {
              const when = item.publishedAt ? DATE_FORMAT.format(new Date(item.publishedAt)) : "—";
              return (
                <li key={item.id} className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{item.themeName}</span>
                      {item.status === "published" && <Badge variant="secondary">No ar</Badge>}
                      {item.config.sections.length > 0 && <Badge variant="outline">{item.config.sections.length} seção(ões)</Badge>}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {when} · {item.authorName ?? "autor desconhecido"}
                      {item.note ? ` · ${item.note}` : ""}
                    </span>
                  </div>
                  {item.status === "archived" && <RollbackButton revisionId={item.id} label={`${item.themeName} (${when})`} />}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
