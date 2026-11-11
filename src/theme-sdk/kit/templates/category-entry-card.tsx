import Link from "next/link";
import { ArrowRight, BookOpen, Calendar } from "lucide-react";
import type { ThemeEntryView } from "@/contexts/themes/contracts/v8";
import { formatDate } from "@/shared/format-date";

// Card de uma entry na listagem de categoria. Usado pelo lote inicial (servidor) e pelos lotes
// carregados no scroll infinito (cliente) — um componente só, então o card é idêntico nos dois.
// Sem hooks e sem "use client": roda nos dois ambientes.
export function CategoryEntryCard({ entry, locale, readMoreLabel }: { entry: ThemeEntryView; locale: string; readMoreLabel: string }) {
  const publishedLabel = formatDate(entry.publishedAt, locale, "long");
  return (
    <Link href={entry.path} className="group block">
      <article className="flex h-full flex-col overflow-hidden rounded-panel border border-border bg-card ui-motion-base group-hover:shadow-float">
        <div className="aspect-video w-full overflow-hidden bg-muted">
          {entry.cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- mesmo padrão do page-builder, sem domínio remoto configurado pra next/image
            <img src={entry.cover.url} alt={entry.cover.alt} className="h-full w-full object-cover ui-motion-emphasis group-hover:scale-105" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground/56">
              <BookOpen className="size-8" strokeWidth={1.5} aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          {publishedLabel && (
            <p className="flex items-center gap-1 text-[11px] font-medium tracking-caps text-muted-foreground/56 uppercase">
              <Calendar className="size-3" aria-hidden="true" /> {publishedLabel}
            </p>
          )}
          <h2 className="text-base font-semibold text-foreground">{entry.title}</h2>
          {entry.excerpt && <p className="line-clamp-3 text-sm text-muted-foreground">{entry.excerpt}</p>}
          <p className="mt-auto flex items-center gap-1 pt-1 text-sm font-medium text-primary">
            {readMoreLabel} <ArrowRight className="size-3.5" aria-hidden="true" />
          </p>
        </div>
      </article>
    </Link>
  );
}
