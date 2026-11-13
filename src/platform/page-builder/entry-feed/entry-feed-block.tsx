import "server-only";
import Link from "next/link";
import { ArrowRight, BookOpen, Pin } from "lucide-react";
import { getCurrentUser } from "@/contexts/auth";
import { Badge } from "@/components/ui/badge";
import { CoverImage } from "@/components/cover-image";
import { cn } from "@/lib/utils";
import { formatDate } from "@/shared/format-date";
import { categoryHref } from "@/platform/category-listing/category-href";
import { resolveDocumentLocale } from "@/platform/theme-rendering/resolve-document-locale";
import type { BlockRendererProps } from "../block-renderers";
import { entryFeedGridClasses, isFeaturedLayout, parseEntryFeedData } from "./entry-feed-data";
import { loadEntryFeed, type EntryFeedItem } from "./load-entry-feed";

// Cartão inteiro clicável (sem botão "Ler"): capa 16/10 com zoom leve e gradiente de token na
// base, categoria como badge sobre a imagem, data em caixa-alta, título (2 linhas), resumo (2
// linhas) e uma seta que desliza no hover. Só tokens shadcn — sem cor crua.
function FeedCard({
  item,
  categoryName,
  locale,
  featured,
}: {
  item: EntryFeedItem;
  categoryName: string;
  locale: string;
  featured: boolean;
}) {
  const dateLabel = formatDate(item.publishedAt, locale, "long");
  return (
    <Link
      href={item.path}
      className={cn(
        "group/feed flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
        "transition-[transform,box-shadow,border-color] duration-300 ease-out",
        "hover:-translate-y-0.5 hover:border-ring/40 hover:shadow-lg",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        featured && "lg:col-span-2 lg:row-span-2",
      )}
    >
      <div className={cn("relative aspect-[16/10] overflow-hidden bg-muted", featured && "lg:aspect-auto lg:min-h-0 lg:flex-1")}>
        {item.coverUrl ? (
          <CoverImage
            src={item.coverUrl}
            alt=""
            width={item.coverWidth}
            height={item.coverHeight}
            className="transition-transform duration-500 ease-out group-hover/feed:scale-105 motion-reduce:transition-none motion-reduce:group-hover/feed:scale-100"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/56">
            <BookOpen className="size-9" strokeWidth={1.5} aria-hidden="true" />
          </div>
        )}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-card/70 to-transparent" />
        <div className="absolute start-3 top-3 flex flex-wrap gap-1.5">
          {item.pinned && (
            <Badge className="h-6 gap-1 px-2.5">
              <Pin className="size-3" aria-hidden="true" />
              Fixado
            </Badge>
          )}
          <Badge variant="secondary" className="h-6 bg-secondary/90 px-2.5 backdrop-blur-sm">
            {categoryName}
          </Badge>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 p-5">
        {dateLabel && <p className="text-[11px] font-medium tracking-caps text-muted-foreground uppercase">{dateLabel}</p>}
        <h3 className={cn("line-clamp-2 text-lg leading-snug font-semibold text-foreground", featured && "lg:text-2xl")}>{item.title}</h3>
        {item.excerpt && <p className="line-clamp-2 text-sm text-muted-foreground">{item.excerpt}</p>}
        <ArrowRight
          aria-hidden="true"
          className="mt-1 size-5 text-primary transition-transform duration-300 ease-out group-hover/feed:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover/feed:translate-x-0 rtl:rotate-180 rtl:group-hover/feed:-translate-x-1"
        />
      </div>
    </Link>
  );
}

export async function EntryFeedBlock({ block, mode }: BlockRendererProps) {
  const config = parseEntryFeedData(block.data);
  const currentUser = await getCurrentUser();
  const viewerIsAuthenticated = currentUser.success && Boolean(currentUser.data);
  const [feed, { locale }] = await Promise.all([
    loadEntryFeed({ categorySlug: config.categorySlug, limit: config.limit, viewerIsAuthenticated, typeKey: config.typeKey }),
    resolveDocumentLocale(),
  ]);

  if (!feed || feed.items.length === 0) {
    // Editor: mostra por que está vazio; publicado: o bloco some (sem seção vazia na página).
    if (mode !== "edit") return null;
    return (
      <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        {!feed
          ? `Categoria "${config.categorySlug}" não encontrada.`
          : feed.typeNotFound
            ? `Tipo "${config.typeKey}" não encontrado.`
            : "Nenhuma publicação visível nesta categoria ainda."}
      </p>
    );
  }

  const featured = isFeaturedLayout(feed.items.length);
  return (
    <section className="space-y-5">
      {(config.title || config.viewAllLabel) && (
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          {config.title && <h2 className="text-2xl font-semibold tracking-tight text-foreground">{config.title}</h2>}
          {config.viewAllLabel && (
            <Link
              href={categoryHref(feed.categoryPath, { typeKey: config.typeKey })}
              className="group/all inline-flex items-center gap-1 text-sm font-medium text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {config.viewAllLabel}
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-300 group-hover/all:translate-x-0.5 motion-reduce:transition-none rtl:rotate-180"
              />
            </Link>
          )}
        </div>
      )}
      <div className={cn("grid gap-4 sm:gap-5", entryFeedGridClasses(feed.items.length))}>
        {feed.items.map((item, index) => (
          <FeedCard key={item.id} item={item} categoryName={feed.categoryName} locale={locale} featured={featured && index === 0} />
        ))}
      </div>
    </section>
  );
}
