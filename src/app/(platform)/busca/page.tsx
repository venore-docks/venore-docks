import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Search } from "lucide-react";
import { extractEntryComposition, listCategories, searchPublishedEntries } from "@/contexts/cms";
import { getCurrentUser } from "@/contexts/auth";
import { checkRateLimit, getClientIp } from "@/infrastructure/rate-limit";
import { extractExcerpt } from "@/platform/seo/entry-excerpt";
import { EmptyState } from "@/components/empty-state";
import { PaginationLinks, parsePageParam } from "@/components/pagination-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

// Resultado de busca não vai pro índice dos buscadores (conteúdo duplicado, URLs infinitas).
export const metadata: Metadata = { title: "Busca", robots: { index: false, follow: true } };

const PAGE_SIZE = 10;
const SEARCH_RATE_LIMIT = { limit: 60, windowMs: 60_000 };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 120);
  const page = parsePageParam(params.page);

  let results: { title: string; href: string; excerpt: string | null }[] = [];
  let hasNextPage = false;
  let limited = false;

  if (query.length >= 2) {
    const limit = await checkRateLimit(`search:${getClientIp(await headers())}`, SEARCH_RATE_LIMIT);
    limited = !limit.allowed;
    if (!limited) {
      const currentUser = await getCurrentUser();
      const [found, categoriesResult] = await Promise.all([
        searchPublishedEntries({
          query,
          includeAuthenticated: currentUser.success && Boolean(currentUser.data),
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        }),
        listCategories(),
      ]);
      const slugById = new Map((categoriesResult.success ? categoriesResult.data : []).map((category) => [category.id, category.slug]));
      if (found.success) {
        hasNextPage = found.data.hasMore;
        results = found.data.entries
          .filter((entry) => !entry.categoryId || slugById.has(entry.categoryId))
          .map((entry) => {
            const categorySlug = entry.categoryId ? slugById.get(entry.categoryId) : null;
            const href = categorySlug ? `/${categorySlug}/${entry.slug}` : entry.slug === "home" ? "/" : `/${entry.slug}`;
            return { title: entry.title, href, excerpt: extractExcerpt(extractEntryComposition(entry.data), 220) };
          });
      }
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Busca</h1>

      <form action="/busca" method="get" role="search" className="flex max-w-xl gap-2">
        <Input name="q" type="search" defaultValue={query} placeholder="O que você procura?" aria-label="Termos da busca" minLength={2} required />
        <Button type="submit">
          <Search className="size-4" aria-hidden="true" /> Buscar
        </Button>
      </form>

      {limited ? (
        <p className="text-sm text-muted-foreground">Muitas buscas seguidas. Aguarde um minuto e tente de novo.</p>
      ) : query.length >= 2 && results.length === 0 ? (
        <EmptyState
          icon={<Search className="size-8" strokeWidth={1.5} />}
          title="Nada encontrado"
          description="Tente outras palavras, menos termos ou sem aspas."
        />
      ) : (
        <ol className="space-y-5">
          {results.map((result) => (
            <li key={result.href} className="space-y-1">
              <Link href={result.href} className="text-base font-semibold text-primary hover:underline">
                {result.title}
              </Link>
              {result.excerpt && <p className="line-clamp-2 text-sm text-muted-foreground">{result.excerpt}</p>}
            </li>
          ))}
        </ol>
      )}

      <PaginationLinks basePath="/busca" params={{ q: query }} page={page} hasNextPage={hasNextPage} />
    </div>
  );
}
