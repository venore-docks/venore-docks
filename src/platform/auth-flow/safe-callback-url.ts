// Destino pós-login vindo do cliente (?callbackUrl=). Só caminho RELATIVO da própria origem:
// "/academy/curso" passa; "//evil.com", "https://evil.com", "/\\evil.com" e "javascript:" não —
// sem isso o parâmetro vira open redirect num link de login legítimo.
export function toSafeCallbackUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (/[\u0000-\u001f]/.test(value)) return null;
  // Não voltar pra telas do próprio fluxo de login (loop).
  if (/^\/(login|post-login|setup)(\/|\?|$)/.test(value)) return null;
  return value.slice(0, 2000);
}
