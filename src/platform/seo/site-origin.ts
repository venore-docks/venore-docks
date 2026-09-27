import { headers } from "next/headers";

// Origem absoluta do site (https://exemplo.com) pra sitemap, RSS, canonical e Open Graph.
// SITE_URL tem prioridade: o Host da requisição vem do cliente, e usar ele em conteúdo cacheável
// (sitemap/RSS) deixaria alguém envenenar o cache com outro domínio. Sem SITE_URL, cai no host
// da requisição (útil em dev e preview).
export async function getSiteOrigin(): Promise<string> {
  const configured = normalizeOrigin(process.env.SITE_URL);
  if (configured) return configured;

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const proto = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return normalizeOrigin(`${proto}://${host}`) ?? "http://localhost:3000";
}

export function normalizeOrigin(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}
