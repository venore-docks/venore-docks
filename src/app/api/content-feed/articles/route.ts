import { NextResponse } from "next/server";
import { listArticlesForConnection } from "@/contexts/content-feed";
import { checkRateLimit } from "@/infrastructure/rate-limit";

// Rota pública que outra instância venore-docks chama pra sincronizar (modelo pull, ver
// docs de arquitetura do context content-feed) — nunca cacheada, lê header por request.
export const dynamic = "force-dynamic";

const RATE_LIMIT_CONFIG = { limit: 30, windowMs: 60_000 };

export async function GET(request: Request): Promise<NextResponse> {
  const key = request.headers.get("x-feed-key");
  if (!key) {
    return NextResponse.json({ error: "Header X-Feed-Key ausente." }, { status: 401 });
  }

  // Rate limit por chave (não por IP) — a mesma fonte assinante sempre bate com a mesma chave,
  // então isolar por chave evita que um assinante barulhento afete outro atrás do mesmo proxy/IP.
  const rateLimit = checkRateLimit(`content-feed.articles:${key}`, RATE_LIMIT_CONFIG);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Muitas requisições. Tente novamente em instantes." }, { status: 429 });
  }

  const since = new URL(request.url).searchParams.get("since");
  const updatedSince = since && !Number.isNaN(Date.parse(since)) ? new Date(since) : undefined;

  const result = await listArticlesForConnection({ key, updatedSince });
  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 401 });
  }

  return NextResponse.json(result.data);
}
