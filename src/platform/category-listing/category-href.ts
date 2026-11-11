// Montagem de links da listagem de categoria (página N + filtro por tipo). Pura, sem I/O.

// `tipo` é a key de um content type; só aceita o formato de key do CMS (minúsculas, dígitos, hífen).
const TYPE_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;

export function parseTypeKey(value: string | string[] | null | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const key = raw?.trim().toLowerCase() ?? "";
  return TYPE_KEY_PATTERN.test(key) ? key : null;
}

export function categoryHref(categoryPath: string, options: { page?: number; typeKey?: string | null } = {}): string {
  const params = new URLSearchParams();
  if (options.typeKey) params.set("tipo", options.typeKey);
  if (options.page && options.page > 1) params.set("page", String(options.page));
  const query = params.toString();
  return query ? `${categoryPath}?${query}` : categoryPath;
}
