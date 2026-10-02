import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Calendar } from "lucide-react";
import type { CategoryTemplateProps } from "@/contexts/themes/contracts/v8";
import { formatEntryDate, templateText } from "./template-strings";

// Template de categoria (blogroll) do kit — o markup de renderCategoryBlogroll antes da v8
// (snapshot: src/app/(platform)/__parity__/category-*.html). `empty` vem pronto do core (estado
// "empty" do tema). Ordenação (`sort`) não é desenhada pelo kit.
export function KitCategoryTemplate({ category, entries, pagination, empty, jsonLd, outlets, strings, locale }: CategoryTemplateProps) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{category.label}</h1>
        {category.description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{category.description}</p>}
      </div>

      {outlets.before}
      {entries.length === 0 ? (
        empty
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-4 sm:gap-5">
          {entries.map((entry) => {
            const publishedLabel = formatEntryDate(entry.publishedAt, locale);
            return (
              <Link key={entry.id} href={entry.path} className="group block">
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
                      {templateText(strings, "category.readMore")} <ArrowRight className="size-3.5" aria-hidden="true" />
                    </p>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      )}
      {outlets.after}

      {(pagination.prevHref || pagination.nextHref) && (
        <nav aria-label={templateText(strings, "category.paginationLabel")} className="flex items-center justify-between gap-4 text-sm">
          {pagination.prevHref ? (
            <Link href={pagination.prevHref} className="flex items-center gap-1 font-medium text-primary">
              <ArrowLeft className="size-3.5" aria-hidden="true" /> {templateText(strings, "category.newer")}
            </Link>
          ) : (
            <span />
          )}
          {pagination.nextHref && (
            <Link href={pagination.nextHref} className="flex items-center gap-1 font-medium text-primary">
              {templateText(strings, "category.older")} <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          )}
        </nav>
      )}
      {jsonLd}
    </div>
  );
}
