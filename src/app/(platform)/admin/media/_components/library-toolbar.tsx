"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KIND_LABELS, SORT_LABELS, VISIBILITY_LABELS, libraryHref, type LibraryParams } from "../_lib/media-library";

const KINDS = ["image", "video", "audio", "document"] as const;
const ALL = "all";

// Filtros da biblioteca: tudo vive na URL (?q=&kind=&visibility=&sort=&view=), então dá pra
// compartilhar/voltar no navegador, e a página inteira é renderizada no servidor.
export function LibraryToolbar({
  params,
  kindCounts,
  visibilityCounts,
  resultLabel,
}: {
  params: LibraryParams;
  kindCounts: Record<(typeof KINDS)[number], number>;
  visibilityCounts: Record<"public" | "private" | "restricted", number>;
  resultLabel: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.q ?? "");
  const lastPushed = useRef(params.q ?? "");

  function navigate(overrides: Partial<Record<keyof LibraryParams, string | undefined>>) {
    startTransition(() => router.replace(libraryHref(params, { ...overrides, page: undefined }), { scroll: false }));
  }

  // Busca com debounce: não recarrega a cada tecla.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === lastPushed.current) return;
    const timer = setTimeout(() => {
      lastPushed.current = trimmed;
      startTransition(() => router.replace(libraryHref(params, { q: trimmed || undefined, page: undefined }), { scroll: false }));
    }, 350);
    return () => clearTimeout(timer);
    // params muda a cada navegação; só queremos reagir ao texto digitado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const activeKind = params.kind ?? ALL;
  const view = params.view === "list" ? "list" : "grid";
  const hasFilters = Boolean(params.q || params.kind || params.visibility);
  const totalOfKinds = KINDS.reduce((sum, key) => sum + kindCounts[key], 0);

  return (
    <div className="space-y-3" aria-busy={isPending}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/56" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar pelo nome do arquivo…"
            aria-label="Buscar arquivos"
            className="h-9 w-full rounded-lg border border-border bg-card ps-9 pe-3 text-sm text-foreground outline-none ui-motion-base placeholder:text-muted-foreground/56 focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={params.visibility ?? ALL} onValueChange={(value) => navigate({ visibility: value === ALL ? undefined : value })}>
            <SelectTrigger className="w-40" aria-label="Filtrar por visibilidade">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toda visibilidade</SelectItem>
              {(Object.keys(VISIBILITY_LABELS) as (keyof typeof VISIBILITY_LABELS)[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {VISIBILITY_LABELS[key]} ({visibilityCounts[key]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={params.sort ?? "newest"} onValueChange={(value) => navigate({ sort: value === "newest" ? undefined : value })}>
            <SelectTrigger className="w-40" aria-label="Ordenar">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as (keyof typeof SORT_LABELS)[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {SORT_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div role="group" aria-label="Modo de exibição" className="flex rounded-lg border border-border bg-card p-0.5">
            {(
              [
                { key: "grid", label: "Grade", icon: <LayoutGrid className="size-4" /> },
                { key: "list", label: "Lista", icon: <List className="size-4" /> },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                type="button"
                aria-label={option.label}
                aria-pressed={view === option.key}
                title={option.label}
                onClick={() => navigate({ view: option.key === "grid" ? undefined : option.key })}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring",
                  view === option.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filtrar por tipo" className="flex flex-wrap gap-1.5">
          {[ALL, ...KINDS].map((kind) => {
            const active = activeKind === kind;
            const count = kind === ALL ? totalOfKinds : kindCounts[kind as (typeof KINDS)[number]];
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={active}
                onClick={() => navigate({ kind: kind === ALL ? undefined : kind })}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-primary/30 bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {kind === ALL ? "Todos os tipos" : KIND_LABELS[kind as (typeof KINDS)[number]]}
                <span className="tabular-nums text-muted-foreground/56">{count}</span>
              </button>
            );
          })}
        </div>

        <p className="ms-auto text-xs text-muted-foreground" aria-live="polite">
          {resultLabel}
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              lastPushed.current = "";
              navigate({ q: undefined, kind: undefined, visibility: undefined });
            }}
            className="flex items-center gap-1 rounded-md text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3" aria-hidden="true" />
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}
