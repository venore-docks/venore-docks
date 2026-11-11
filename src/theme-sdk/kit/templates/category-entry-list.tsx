"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { ThemeEntryView } from "@/contexts/themes/contracts/v8";
import { CategoryEntryCard } from "./category-entry-card";

type Labels = { readMore: string; loadingMore: string; loadError: string; retry: string };

type Props = {
  // Slug da categoria (rota /api/category-entries?category=<slug>&page=<n>).
  categorySlug: string;
  initialEntries: ThemeEntryView[];
  // Página já carregada (a rota recebe `?page=N` no fallback sem JS).
  initialPage: number;
  initialHasNext: boolean;
  locale: string;
  labels: Labels;
  // Navegação por links (anterior/próxima): só aparece sem JS (<noscript>) — progressive
  // enhancement e rastreadores que não executam script seguem paginando por link.
  fallbackNav: ReactNode;
};

type LoadState = "idle" | "loading" | "error";

// Lista de cards com carregamento automático: um IntersectionObserver na sentinela do fim da lista
// busca o próximo lote e ANEXA aos cards já exibidos (nada de trocar de página).
export function CategoryEntryList({ categorySlug, initialEntries, initialPage, initialHasNext, locale, labels, fallbackNav }: Props) {
  const [entries, setEntries] = useState(initialEntries);
  const [page, setPage] = useState(initialPage);
  const [hasNext, setHasNext] = useState(initialHasNext);
  const [state, setState] = useState<LoadState>("idle");
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const inFlight = useRef(false);

  const loadMore = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState("loading");
    try {
      const response = await fetch(`/api/category-entries?category=${encodeURIComponent(categorySlug)}&page=${page + 1}`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as { entries: ThemeEntryView[]; hasNextPage: boolean };
      setEntries((current) => {
        const seen = new Set(current.map((entry) => entry.id));
        return [...current, ...data.entries.filter((entry) => !seen.has(entry.id))];
      });
      setPage((current) => current + 1);
      setHasNext(data.hasNextPage);
      setState("idle");
    } catch {
      setState("error");
    } finally {
      inFlight.current = false;
    }
  }, [categorySlug, page]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNext || state !== "idle") return;
    const observer = new IntersectionObserver(
      (observed) => {
        if (observed.some((item) => item.isIntersecting)) void loadMore();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNext, state, loadMore, entries.length]);

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-4 sm:gap-5">
        {entries.map((entry) => (
          <CategoryEntryCard key={entry.id} entry={entry} locale={locale} readMoreLabel={labels.readMore} />
        ))}
      </div>
      {hasNext && <div ref={sentinelRef} aria-hidden="true" className="h-px" />}
      <div role="status" aria-live="polite" className="text-center text-sm text-muted-foreground">
        {state === "loading" && labels.loadingMore}
        {state === "error" && (
          <span className="inline-flex flex-wrap items-center justify-center gap-2">
            {labels.loadError}
            <button type="button" onClick={() => void loadMore()} className="font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              {labels.retry}
            </button>
          </span>
        )}
      </div>
      <noscript>{fallbackNav}</noscript>
    </>
  );
}
