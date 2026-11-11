import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { CategoryTemplateProps } from "@/contexts/themes/contracts/v8";
import { CategoryEntryList } from "./category-entry-list";
import { templateText } from "./template-strings";

// Template de categoria (blogroll) do kit — o markup de renderCategoryBlogroll antes da v8
// (snapshot: src/app/(platform)/__parity__/category-*.html). `empty` vem pronto do core (estado
// "empty" do tema). Ordenação (`sort`) não é desenhada pelo kit.
//
// A lista carrega os lotes seguintes sozinha ao chegar perto do fim (CategoryEntryList, cliente);
// o link "mais antigos" só aparece sem JavaScript (<noscript>) e o "mais recentes" quando a página
// foi aberta direto em `?page=N`.
// Chip do filtro por tipo: link real (funciona sem JavaScript); o ativo usa os tokens de destaque.
function TypeChip({ href, active, label, count }: { href: string; active: boolean; label: string; count?: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`rounded-full px-1.5 text-xs tabular-nums ${active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"}`}>{count}</span>
      )}
    </Link>
  );
}

export function KitCategoryTemplate({ category, entries, pagination, typeFilter, empty, jsonLd, outlets, strings, locale }: CategoryTemplateProps) {
  const categorySlug = category.path.replace(/^\//, "");
  const olderLink = pagination.nextHref ? (
    <nav aria-label={templateText(strings, "category.paginationLabel")} className="flex items-center justify-end gap-4 text-sm">
      <Link href={pagination.nextHref} className="flex items-center gap-1 font-medium text-primary">
        {templateText(strings, "category.older")} <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </nav>
  ) : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{category.label}</h1>
        {category.description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{category.description}</p>}
      </div>

      {outlets.before}
      {typeFilter && (
        <nav aria-label={templateText(strings, "category.typeFilterLabel")}>
          <ul className="flex gap-2 overflow-x-auto pb-1">
            <li className="shrink-0">
              <TypeChip href={typeFilter.allHref} active={typeFilter.typeKey === null} label={templateText(strings, "category.allTypes")} />
            </li>
            {typeFilter.options.map((option) => (
              <li key={option.key} className="shrink-0">
                <TypeChip href={option.href} active={option.active} label={option.label} count={option.count} />
              </li>
            ))}
          </ul>
        </nav>
      )}
      {pagination.prevHref && (
        <nav aria-label={templateText(strings, "category.paginationLabel")} className="text-sm">
          <Link href={pagination.prevHref} className="inline-flex items-center gap-1 font-medium text-primary">
            <ArrowLeft className="size-3.5" aria-hidden="true" /> {templateText(strings, "category.newer")}
          </Link>
        </nav>
      )}
      {entries.length === 0 ? (
        empty
      ) : (
        <CategoryEntryList
          key={typeFilter?.typeKey ?? "all"}
          categorySlug={categorySlug}
          typeKey={typeFilter?.typeKey ?? null}
          initialEntries={entries}
          initialPage={pagination.page}
          initialHasNext={pagination.nextHref !== null}
          locale={locale}
          labels={{
            readMore: templateText(strings, "category.readMore"),
            loadingMore: templateText(strings, "category.loadingMore"),
            loadError: templateText(strings, "category.loadError"),
            retry: templateText(strings, "category.retry"),
          }}
          fallbackNav={olderLink}
        />
      )}
      {outlets.after}
      {jsonLd}
    </div>
  );
}
