// Orçamento de performance por tema (spec §2.9 / §7.12). Calibrado sobre os máximos medidos
// (3.5 KB de CSS gz, 7.3 KB de JS gz). Um manifesto pode baixar ou subir até o MAX.
export type ThemeBudgets = { cssGzipBytes: number; lineageCssGzipBytes: number; clientJsGzipBytes: number; clientModules: number };
export const DEFAULT_THEME_BUDGETS: ThemeBudgets = {
  cssGzipBytes: 6_144,
  lineageCssGzipBytes: 10_240,
  clientJsGzipBytes: 12_288,
  clientModules: 12,
};
export const MAX_THEME_BUDGETS: ThemeBudgets = {
  cssGzipBytes: 12_288,
  lineageCssGzipBytes: 20_480,
  clientJsGzipBytes: 24_576,
  clientModules: 24,
};
