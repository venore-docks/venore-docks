// Formatação de data por locale (spec v8 §7.11) — substitui os `"pt-BR"` fixos em Intl. Puro:
// quem chama passa o locale do documento (resolveDocumentLocale / props `locale` do kit). Locale
// inválido cai no pt-BR em vez de lançar (o setting é validado, mas prop de tema pode vir crua).
export const DEFAULT_DATE_LOCALE = "pt-BR";

export type DateInput = Date | string | number | null | undefined;

export const DATE_PRESETS = {
  // "15 de março de 2026" — data de publicação dos templates.
  long: { day: "2-digit", month: "long", year: "numeric" },
  // "15/03/2026".
  short: { dateStyle: "short" },
  // "15/03/2026, 14:30".
  dateTime: { dateStyle: "short", timeStyle: "short" },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DatePreset = keyof typeof DATE_PRESETS;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateFormatter(locale: string | null | undefined, options: Intl.DateTimeFormatOptions | DatePreset = "short"): Intl.DateTimeFormat {
  const resolved = typeof options === "string" ? DATE_PRESETS[options] : options;
  try {
    return new Intl.DateTimeFormat(locale || DEFAULT_DATE_LOCALE, resolved);
  } catch {
    return new Intl.DateTimeFormat(DEFAULT_DATE_LOCALE, resolved);
  }
}

// Data inválida/ausente → null (quem chama decide o texto: "—", "Nunca" etc.).
export function formatDate(
  value: DateInput,
  locale: string | null | undefined,
  options: Intl.DateTimeFormatOptions | DatePreset = "short",
): string | null {
  const date = toDate(value);
  return date ? dateFormatter(locale, options).format(date) : null;
}
