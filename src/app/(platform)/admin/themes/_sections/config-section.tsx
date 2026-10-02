import Link from "next/link";
import { loadThemeDraftStatus } from "@/platform/theme-engine/theme-config";
import { DEFAULT_DATE_LOCALE, formatDate } from "@/shared/format-date";

const LINK_CLASS = "text-primary underline";

// Estado do rascunho de config de tema e atalhos (spec v8 §9). Dono: W6. Sem rascunho a seção
// fica discreta (só os atalhos); com rascunho, avisa que há mudança não publicada.
export async function ConfigSection() {
  const status = await loadThemeDraftStatus();
  if (!status.success) return null;
  const { draft, storageUnavailable } = status.data;

  if (storageUnavailable) {
    return (
      <p role="status" className="rounded-panel border border-warning-border bg-warning-soft ui-panel-padding text-sm text-warning">
        Rascunho e histórico de aparência indisponíveis neste ambiente (migration pendente). O site continua normal.
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-2 rounded-panel border border-border bg-card ui-panel-padding-roomy text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground">
        {draft
          ? `Há um rascunho de aparência não publicado (salvo em ${formatDate(draft.createdAt, DEFAULT_DATE_LOCALE, "dateTime")}).`
          : "Nenhum rascunho em andamento — o site mostra a aparência publicada."}
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/admin/themes/customize" className={LINK_CLASS}>
          {draft ? "Continuar rascunho" : "Personalizar"}
        </Link>
        <Link href="/admin/themes/history" className={LINK_CLASS}>
          Histórico
        </Link>
        {/* GET num route handler (não é página): form em vez de <Link>, que faria prefetch. */}
        <form action="/api/themes/safe-mode" method="get">
          <input type="hidden" name="on" value="1" />
          <input type="hidden" name="next" value="/admin/themes" />
          <button type="submit" className={LINK_CLASS} title="Usa o tema padrão só para você, por até 2 horas">
            Modo seguro
          </button>
        </form>
      </div>
    </section>
  );
}
