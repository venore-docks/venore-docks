type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitConfig = { limit: number; windowMs: number };

export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number };

// Janela fixa por chave (ator ou IP), em memória do processo — suficiente pra um único
// endpoint sensível (upload) sem depender de infra externa (Redis/Upstash) ainda não presente
// no repo (AGENTS.md — Known Gaps, "rate limiting ... nenhuma implementação encontrada").
// Limitador em memória, por processo — só pra testes e dev sem banco. Produção usa o de Postgres
// (postgres-rate-limiter.ts), compartilhado entre instâncias.
const MAX_BUCKETS = 10_000;

function evictExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

export function checkRateLimitInMemory(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  // Sem isso o Map crescia pra sempre com chaves distintas (um balde por IP/chave inventada).
  if (buckets.size >= MAX_BUCKETS) evictExpired(now);
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    const resetAt = now + config.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.limit - 1, resetAt };
  }

  if (existing.count >= config.limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: config.limit - existing.count, resetAt: existing.resetAt };
}

export function resetRateLimiter(): void {
  buckets.clear();
}
