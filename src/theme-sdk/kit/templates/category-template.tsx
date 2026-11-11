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
export function KitCategoryTemplate({ category, entries, pagination, empty, jsonLd, outlets, strings, locale }: CategoryTemplateProps) {
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
          categorySlug={categorySlug}
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
