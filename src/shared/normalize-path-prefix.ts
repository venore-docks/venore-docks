// Normaliza um prefixo de caminho (spec v8 §7.3 / B2): decodifica %XX, NFC, minúsculas, garante a
// "/" inicial, colapsa "//" e tira a "/" final (exceto na raiz). Usado por seções de tema (W6) e
// pelo scopePath do menu contextual (W7) — escrita, leitura e comparação usam a mesma forma.
export function normalizePathPrefix(input: string): string {
  let value = input.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    // %XX inválido: segue com o texto cru (ainda normalizado abaixo).
  }
  value = value.normalize("NFC").toLowerCase();
  if (!value.startsWith("/")) value = `/${value}`;
  value = value.replace(/\/{2,}/g, "/");
  if (value.length > 1 && value.endsWith("/")) value = value.slice(0, -1);
  return value;
}

// `pathname` está sob `prefix` em fronteira de segmento (/rh casa /rh e /rh/x, nunca /rhx).
export function isPathUnderPrefix(pathname: string, prefix: string): boolean {
  const path = normalizePathPrefix(pathname);
  const base = normalizePathPrefix(prefix);
  return base === "/" || path === base || path.startsWith(`${base}/`);
}
