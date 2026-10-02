// 42P01 = undefined_table: a migration 0054 não rodou (ex: preview da Vercel sem
// MIGRATE_ON_PREVIEW). Store converte em themes.config.storage_unavailable (spec §4.2) — o admin
// mostra um aviso, o render não depende da tabela.
export const THEME_CONFIG_STORAGE_UNAVAILABLE = "themes.config.storage_unavailable";

export function isUndefinedTableError(error: unknown): boolean {
  for (let current: unknown = error, depth = 0; current && depth < 4; depth += 1) {
    if (typeof current === "object" && (current as { code?: unknown }).code === "42P01") return true;
    current = typeof current === "object" ? (current as { cause?: unknown }).cause : null;
  }
  return false;
}
