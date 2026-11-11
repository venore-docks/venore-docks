import { NextResponse } from "next/server";
import { getCachedCategoryBySlug } from "@/contexts/cms";
import { getCurrentUser } from "@/contexts/auth";
import { checkRateLimitInMemory, getClientIp } from "@/infrastructure/rate-limit";
import { loadCategoryEntries } from "@/platform/category-listing/load-category-entries";

export const dynamic = "force-dynamic";

const RATE_LIMIT = { limit: 120, windowMs: 60_000 };
const MAX_PAGE = 10_000;

// GET /api/category-entries?category=<slug>&page=<n> — próximo lote da listagem de categoria
// (scroll infinito). Mesma regra de visibilidade da página: sem sessão só "public" (C7), filtrado
// no banco antes da paginação. Resposta é por sessão (`private`) e curta, nunca cacheada em CDN.
export async function GET(request: Request): Promise<NextResponse> {
  const limit = checkRateLimitInMemory(`category-entries:${getClientIp(request.headers)}`, RATE_LIMIT);
  if (!limit.allowed) return NextResponse.json({ error: "Muitas requisições." }, { status: 429 });

  const url = new URL(request.url);
  const slug = url.searchParams.get("category")?.trim() ?? "";
  const page = Number(url.searchParams.get("page"));
  if (!slug || slug.length > 120 || !Number.isInteger(page) || page < 1 || page > MAX_PAGE) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const categoryResult = await getCachedCategoryBySlug(slug);
  if (!categoryResult.success || !categoryResult.data) {
    return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 });
  }
  const currentUser = await getCurrentUser();
  const viewerIsAuthenticated = currentUser.success && Boolean(currentUser.data);

  const { entries, hasNextPage } = await loadCategoryEntries({
    category: categoryResult.data,
    page,
    viewerIsAuthenticated,
  });
  return NextResponse.json(
    { entries, hasNextPage },
    { headers: { "Cache-Control": "private, max-age=30", Vary: "Cookie" } },
  );
}
