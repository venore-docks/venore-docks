// i18n do tema (spec §2.9 / §7.11). `ThemeText` é texto literal ou chave de catálogo.
export type ThemeText = string | { messageKey: string };
export type ThemeMessages = Readonly<Record<string /* locale */, Readonly<Record<string, string>>>>;
// Strings já resolvidas pro locale do request (kit + cadeia do tema). Dado puro — serializável.
export type ThemeStrings = Readonly<Record<string, string>>;
