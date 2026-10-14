// Contrato entre o harness SSR (src/themes/theme-ssr.harness.test.tsx, vitest) e a suíte
// Playwright (e2e-themes/*.spec.ts): onde o HTML fica, o placeholder do CSS e o manifesto das
// páginas. Sem import de app (roda nos dois processos).

export const SSR_OUTPUT_DIR = "test-results/themes-ssr";
export const SCREENSHOT_DIR = "test-results/themes-screenshots";
export const A11Y_RESULTS_DIR = "test-results/themes-a11y";
// O CSS do app (~300 KB) é gravado uma vez em app.css e injetado no lugar disto pelo Playwright.
export const APP_CSS_PLACEHOLDER = "<!--venore-app-css-->";

export type SsrManifestPage = {
  theme: string;
  scenario: string;
  file: string; // relativo a SSR_OUTPUT_DIR
  contract: 7 | 8;
  legacy: boolean;
  area: "public" | "admin";
  dir: "ltr" | "rtl";
  colorModes: ("light" | "dark")[];
  mobileNav: "drawer" | "bottom-bar" | "fullscreen";
  mobileToggleLabel: string | null;
  skipLinkHref: string | null;
};

export type SsrManifest = { generatedAt: string; themes: string[]; pages: SsrManifestPage[] };

// VENORE_THEME_KEYS=aurora,nite restringe harness e Playwright (scripts/theme-check.ts num repo de
// tema roda só o tema candidato + o fallback).
export function selectedThemeKeys(all: readonly string[], env: string | undefined = process.env.VENORE_THEME_KEYS): string[] {
  const wanted = (env ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  const sorted = [...all].sort();
  if (wanted.length === 0) return sorted;
  return sorted.filter((key) => wanted.includes(key)).concat(wanted.filter((key) => !all.includes(key)));
}
