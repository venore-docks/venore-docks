import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { APP_CSS_PLACEHOLDER, selectedThemeKeys, SSR_OUTPUT_DIR, type SsrManifest, type SsrManifestPage } from "./ssr-output";

export const ROOT = path.resolve(__dirname, "..");
export const SSR_DIR = path.join(ROOT, SSR_OUTPUT_DIR);
export const MANIFEST_PATH = path.join(SSR_DIR, "manifest.json");
export const A11Y_BASELINE_PATH = path.join(__dirname, "a11y-baseline.json");

// Cenários abertos no navegador (o harness SSR cobre todos; aqui ficam os que mudam o que o
// usuário vê/alcança): nav principal logado, nav do admin, rail colapsada, RTL e — só no kit v8 —
// a barra inferior mobile (sem hambúrguer).
export const BROWSER_SCENARIOS = ["logged-in", "admin", "collapsed", "rtl-ar", "mobile-bottom-bar"] as const;
const V8_ONLY_SCENARIOS = new Set<string>(["mobile-bottom-bar"]);

export type ColorMode = "light" | "dark";
export type BrowserPage = SsrManifestPage & { mode: ColorMode };

export function readManifest(): SsrManifest | null {
  if (!existsSync(MANIFEST_PATH)) return null;
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as SsrManifest;
}

export function browserPages(manifest: SsrManifest): BrowserPage[] {
  const themes = new Set(selectedThemeKeys(manifest.themes));
  return manifest.pages
    .filter((page) => themes.has(page.theme))
    .filter((page) => (BROWSER_SCENARIOS as readonly string[]).includes(page.scenario))
    .filter((page) => !(page.legacy && V8_ONLY_SCENARIOS.has(page.scenario)))
    .flatMap((page) => page.colorModes.map((mode) => ({ ...page, mode })));
}

let appCss: string | null = null;

// HTML pronto pro setContent: CSS do app inline e a classe `dark` no <html> (o que o next-themes
// faria no client) — aplicados ANTES do primeiro paint, sem transição de cor no meio do teste.
export function pageHtml(page: BrowserPage): string {
  appCss ??= readFileSync(path.join(SSR_DIR, "app.css"), "utf8");
  const html = readFileSync(path.join(SSR_DIR, page.file), "utf8").replace(APP_CSS_PLACEHOLDER, () => `<style id="app-css">${appCss}</style>`);
  return page.mode === "dark" ? html.replace('<html class="', '<html class="dark ') : html;
}

export function pageId(page: BrowserPage, viewport: string): string {
  return `${page.scenario}/${viewport}/${page.mode}`;
}

export type A11yBaseline = Record<string, Record<string, string[]>>;

export function readBaseline(): A11yBaseline {
  return JSON.parse(readFileSync(A11Y_BASELINE_PATH, "utf8")) as A11yBaseline;
}
