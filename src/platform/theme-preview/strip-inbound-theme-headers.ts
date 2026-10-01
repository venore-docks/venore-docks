// Headers `x-venore-theme-*` são canal interno (nenhum é aceito de fora): o proxy os remove de
// toda request antes de qualquer Server Component ler os headers (spec §6). Override de tema só
// existe via cookie assinado — nunca por header que o cliente consiga forjar.
export const INBOUND_THEME_HEADER_PREFIX = "x-venore-theme-";

export function stripInboundThemeHeaders(headers: Headers): void {
  const names: string[] = [];
  headers.forEach((_value, name) => {
    if (name.toLowerCase().startsWith(INBOUND_THEME_HEADER_PREFIX)) names.push(name);
  });
  for (const name of names) headers.delete(name);
}
