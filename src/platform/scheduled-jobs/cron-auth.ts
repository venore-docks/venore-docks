import { createHash, timingSafeEqual } from "node:crypto";

// "Authorization: Bearer <CRON_SECRET>" — o mesmo segredo do /api/cron/tick, usado também pelo
// worker de leitura em voz alta. Sem CRON_SECRET o endpoint fica desligado (503), nunca aberto.
export function cronSecretConfigured(): boolean {
  return Boolean(process.env.CRON_SECRET?.trim());
}

export function isCronRequestAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  const received = createHash("sha256").update(header).digest();
  return timingSafeEqual(expected, received);
}

// Resposta padrão de recusa, ou null quando a requisição pode seguir.
export function rejectUnlessCron(request: Request): Response | null {
  if (!cronSecretConfigured()) return Response.json({ error: "CRON_SECRET não configurada." }, { status: 503 });
  if (!isCronRequestAuthorized(request)) return Response.json({ error: "Não autorizado." }, { status: 401 });
  return null;
}
