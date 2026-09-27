// IP do cliente pra chave de rate limit. Ordem de confiança:
//   1. x-vercel-forwarded-for — a Vercel sobrescreve, o cliente não controla.
//   2. x-real-ip — definido pelo proxy reverso (nginx/Caddy) em self-host.
//   3. ÚLTIMO item do x-forwarded-for — o que o proxy mais próximo do servidor anexou. O primeiro
//      item (usado antes) é o que o cliente mandou: trocar a cada requisição furava o limite.
// Sem nenhum desses (acesso direto sem proxy), "unknown": todos dividem o mesmo balde — mais
// restritivo, nunca mais permissivo.
export function getClientIp(headers: Headers): string {
  const vercel = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((hop) => hop.trim()).filter(Boolean);
    const last = hops.at(-1);
    if (last) return last;
  }

  return "unknown";
}
