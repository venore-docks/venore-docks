import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Paginação "anterior / próxima" por ?page= — as listagens buscam limit+1 linhas pra saber se há
// próxima página, sem COUNT(*). Preserva os outros parâmetros da URL (filtros).
export function PaginationLinks({
  basePath,
  params,
  page,
  hasNextPage,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  hasNextPage: boolean;
}) {
  if (page <= 1 && !hasNextPage) return null;

  const hrefFor = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
    if (target > 1) search.set("page", String(target));
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-4 text-sm">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="flex items-center gap-1 font-medium text-primary">
          <ChevronLeft className="size-4" aria-hidden="true" /> Anterior
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted-foreground">Página {page}</span>
      {hasNextPage ? (
        <Link href={hrefFor(page + 1)} className="flex items-center gap-1 font-medium text-primary">
          Próxima <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function parsePageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number(raw);
  return Number.isInteger(page) && page >= 1 && page <= 100_000 ? page : 1;
}
