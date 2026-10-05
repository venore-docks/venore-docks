import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { renderToReadableStream } from "react-dom/server.edge";
import { JSDOM } from "jsdom";
import type { ThemeOutletName, ThemeRenderModel } from "@/contexts/themes/contracts/v8";
import { buildFixtureRenderModel, FixtureShell } from "@/platform/theme-gallery/fixture-model";
import { fixturePageContent, THEME_FIXTURE_SCENARIOS, type ThemeFixtureScenario } from "@/platform/theme-gallery/fixtures";
import { validateThemeOptionFields } from "@/platform/theme-engine/theme-options";
import { resolveThemeDefinition } from "@/platform/theme-rendering/resolve-theme-definition";
import { resolveThemeStrings } from "@/platform/theme-rendering/resolve-theme-strings";
import { compileAppCss } from "../../scripts/lib/theme-check/compile-app-css";
import { APP_CSS_PLACEHOLDER, selectedThemeKeys, SSR_OUTPUT_DIR, type SsrManifest, type SsrManifestPage } from "../../e2e-themes/ssr-output";
import baseline from "./theme-ssr.baseline.json";
import { THEME_REGISTRY } from "./registry";

// Harness SSR de todo tema do registro (spec v8 §10): cada tema × cada cenário de fixture
// (platform/theme-gallery/fixtures.ts, os mesmos da galeria) renderizado pelo MESMO caminho do
// (platform)/layout — LegacyShellAdapter (7.x), kit admin (v8 em /admin) ou ThemeRenderer — via
// renderToReadableStream (regiões/outlets podem ser async). Confere landmarks, navs rotuladas,
// JSON-LD escapado, outlets nas regiões do kit, skip link e os modos de navegação mobile; e grava
// o HTML de cada página + o CSS do app compilado em test-results/themes-ssr/ pro Playwright
// (playwright.themes.config.ts) abrir via setContent, sem build nem banco.
//
// Dívida dos temas 7.x (Shell do pacote, fora do alcance do core) fica em theme-ssr.baseline.json
// ("tema": ["cenário:checagem", …]) — catraca nos dois sentidos, como a de contraste. Depois de
// mudar um tema de propósito: UPDATE_THEME_SSR_BASELINE=1 npx vitest run src/themes/theme-ssr.harness.test.tsx
vi.mock("next/navigation", () => ({
  usePathname: () => "/blog",
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {}, prefetch: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/font/google", async () => (await import("@/test-support/themes/next-font-google-mock")).nextFontGoogleMock());

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const OUT_DIR = path.join(ROOT, SSR_OUTPUT_DIR);
const BASELINE_PATH = fileURLToPath(new URL("./theme-ssr.baseline.json", import.meta.url));
const recorded = baseline as Record<string, string[]>;
const updateBaseline = process.env.UPDATE_THEME_SSR_BASELINE === "1";

const themeKeys = selectedThemeKeys(Object.keys(THEME_REGISTRY));

// --- render ----------------------------------------------------------------------------------

async function renderBody(model: ThemeRenderModel): Promise<string> {
  const errors: unknown[] = [];
  const stream = await renderToReadableStream(<FixtureShell model={model}>{fixturePageContent()}</FixtureShell>, {
    onError: (error) => {
      errors.push(error);
    },
  });
  await stream.allReady;
  const html = await new Response(stream).text();
  if (errors.length > 0) throw new AggregateError(errors, `SSR de ${model.theme.key} lançou`);
  return html;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// Documento como o RootLayout monta (<html lang dir data-theme {...atributos de opção} class>, CSS
// de runtime no <style id="theme-runtime">), com o CSS do app no lugar do placeholder.
function documentHtml(model: ThemeRenderModel, scenario: ThemeFixtureScenario, body: string): string {
  const attributes = Object.entries(model.htmlAttributes)
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join("");
  const runtime = model.runtimeCss ? `<style id="theme-runtime">${model.runtimeCss}</style>` : "";
  return [
    "<!DOCTYPE html>",
    `<html class="${escapeAttribute(`${model.fonts.classNames} h-full antialiased`)}" lang="${model.locale}" dir="${model.dir}" data-theme="${escapeAttribute(model.theme.key)}"${attributes}>`,
    `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeAttribute(`${model.theme.key} — ${scenario.name}`)}</title>${APP_CSS_PLACEHOLDER}${runtime}</head>`,
    `<body class="min-h-full flex flex-col">${body}</body>`,
    "</html>",
  ].join("");
}

// --- checagens -------------------------------------------------------------------------------

// header/footer só são landmark (banner/contentinfo) fora de article/aside/main/nav/section.
const SECTIONING = "article, aside, main, nav, section";
const landmarks = (doc: Document, tag: "header" | "footer") =>
  [...doc.querySelectorAll(tag)].filter((element) => !element.parentElement?.closest(SECTIONING));

// Outlets que só existem dentro de template (render-template.tsx, PAGE_TEMPLATE_OUTLETS).
const PAGE_TEMPLATE_OUTLETS: readonly ThemeOutletName[] = ["home.showcase", "entry.after-content"];

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex='-1'])";

// Outlets que o kit desenha em cada região, condicionados ao que o cenário monta.
function expectedOutlets(model: ThemeRenderModel): ThemeOutletName[] {
  if (model.theme.legacyShell) return ["content.before", "content.after"];
  return model.theme.outletsRendered.filter((name) => {
    if (PAGE_TEMPLATE_OUTLETS.includes(name)) return false; // só dentro de template
    if (name === "userMenu.items") return Boolean(model.slotProps.header.userbarEnabled && model.slotProps.header.user);
    if (name.startsWith("rail.")) return model.slotProps.sidebarLeft.enabled;
    if (name.startsWith("contextual.")) return model.contextual.source !== "none" && model.page.contextualPlacement !== "none";
    return true;
  });
}

type CheckResult = { failures: string[]; page: SsrManifestPage };

function check(model: ThemeRenderModel, scenario: ThemeFixtureScenario, body: string, file: string): CheckResult {
  const doc = new JSDOM(`<!DOCTYPE html><html><body>${body}</body></html>`).window.document;
  const failures: string[] = [];
  const fail = (id: string) => failures.push(`${scenario.name}:${id}`);
  const isV8Kit = !model.theme.legacyShell;
  const isV8Public = isV8Kit && model.area === "public";

  // Landmarks: um header (o #site-header do kit, ou o único banner), um main, um footer.
  const siteHeaders = doc.querySelectorAll("#site-header").length;
  if (!(siteHeaders === 1 || (siteHeaders === 0 && landmarks(doc, "header").length === 1))) fail("one-header");
  if (doc.querySelectorAll("main").length !== 1) fail("one-main");
  if (landmarks(doc, "footer").length !== 1) fail("one-footer");

  // Toda <nav> com nome acessível.
  const unlabeled = [...doc.querySelectorAll("nav")].filter(
    (nav) => !(nav.getAttribute("aria-label")?.trim() || nav.getAttribute("aria-labelledby")?.trim()),
  );
  if (unlabeled.length > 0) fail("labeled-navs");

  // JSON-LD da trilha (core): nunca fecha o <script> e é JSON válido.
  const jsonLd = [...body.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  if (jsonLd.some((text) => /<\/script/i.test(text))) fail("json-ld-escaped");
  for (const text of jsonLd) {
    try {
      JSON.parse(text);
    } catch {
      fail("json-ld-valid");
    }
  }
  if (model.breadcrumbsJsonLd && jsonLd.length !== 1) fail("json-ld-present");

  // Outlets: o marcador de cada outlet que a região do kit desenha.
  if (scenario.outlets) {
    for (const name of expectedOutlets(model)) {
      // O adapter 7.x passa content.before/after crus pro Shell (sem o <ThemeOutlet> do kit).
      const selector = isV8Kit ? `[data-outlet="${name}"] [data-fixture-outlet="${name}"]` : `[data-fixture-outlet="${name}"]`;
      if (!doc.querySelector(selector)) fail(`outlet:${name}`);
    }
  }

  // Skip link: primeiro focável, apontando pro <main id="conteudo">.
  const firstFocusable = doc.querySelector(FOCUSABLE);
  const skipTarget = firstFocusable?.getAttribute("href")?.startsWith("#") ? firstFocusable.getAttribute("href")!.slice(1) : null;
  if (!skipTarget || doc.querySelector("main")?.id !== skipTarget) fail("skip-link-first");

  // Navegação mobile (W3): drawer/tela cheia têm o botão no header; barra inferior não tem hambúrguer.
  const mobileNav = doc.querySelector("nav[data-region='mobile-nav'][data-mobile-nav]");
  const toggle = doc.querySelector("header button[aria-expanded]");
  const mode = scenario.arrangement?.mobileNav;
  if (isV8Public && mode === "bottom-bar") {
    if (mobileNav?.getAttribute("data-mobile-nav") !== "bottom-bar") fail("mobile-nav:bottom-bar");
    if (doc.querySelector(`header button[aria-label="${model.strings["mobileNav.open"]}"]`)) fail("mobile-nav:no-hamburger");
  } else if (isV8Public && mode === "fullscreen") {
    if (mobileNav?.getAttribute("data-mobile-nav") !== "fullscreen") fail("mobile-nav:fullscreen");
    if (!toggle) fail("mobile-nav:toggle");
  } else if (!toggle) {
    fail("mobile-nav:toggle");
  }

  // Layout de página e RTL (só o kit v8 recebe page/strings; Shell 7.x é do pacote).
  // Rail oculta pela página: continua montada (drawer abaixo de lg, navegação soft), mas marcada pro
  // page-layout.css escondê-la a partir de lg.
  if (isV8Public && scenario.page?.showRail === false && doc.querySelector("[data-region='rail']") && !doc.querySelector("[data-page-rail-initial='hidden'] [data-region='rail']")) {
    fail("page:rail-hidden");
  }
  if (isV8Public && scenario.dir === "rtl" && firstFocusable?.textContent === resolveThemeStrings(model.theme, "pt-BR")["skipLink.label"]) {
    fail("rtl:strings");
  }
  if (isV8Public && scenario.arrangement?.layoutPreset === "rail" && !doc.querySelector("[data-layout='rail']")) {
    fail("layout:rail");
  }

  const toggleLabel = toggle?.getAttribute("aria-label") ?? null;
  return {
    failures,
    page: {
      theme: model.theme.key,
      scenario: scenario.name,
      file,
      contract: model.theme.contract,
      legacy: Boolean(model.theme.legacyShell),
      area: model.area,
      dir: model.dir,
      colorModes: [...model.theme.manifest.colorModes],
      mobileNav: isV8Public ? (mode ?? model.theme.responsive.mobileNav) : "drawer",
      mobileToggleLabel: toggleLabel,
      skipLinkHref: skipTarget ? `#${skipTarget}` : null,
    },
  };
}

// --- suíte -----------------------------------------------------------------------------------

const results = new Map<string, string[]>();
const pages: SsrManifestPage[] = [];

beforeAll(async () => {
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(path.join(OUT_DIR, "app.css"), await compileAppCss(ROOT));
}, 60_000);

afterAll(() => {
  const manifest: SsrManifest = { generatedAt: new Date().toISOString(), themes: themeKeys, pages };
  writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  if (updateBaseline) {
    const merged: Record<string, string[]> = { ...recorded };
    for (const key of themeKeys) {
      const list = results.get(key) ?? [];
      if (list.length > 0) merged[key] = [...list].sort();
      else delete merged[key];
    }
    const sorted = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2) + "\n");
  }
});

describe("harness SSR — todo tema do registro × cenários de fixture", () => {
  it("cobre o registro inteiro (ou VENORE_THEME_KEYS) e o baseline não cita tema v8 do registro", () => {
    expect(themeKeys.length).toBeGreaterThan(0);
    expect(themeKeys.filter((key) => !THEME_REGISTRY[key])).toEqual([]);
    // Entradas de pacotes ausentes neste branch são ignoradas (o baseline é compartilhado entre
    // branches de instância); o venore-slime e todo tema v8 presente não podem ter dívida.
    expect(Object.keys(recorded).filter((key) => THEME_REGISTRY[key]?.contract === 8)).toEqual([]);
  });

  for (const key of themeKeys) {
    it(`${key}: renderiza todos os cenários; nenhuma falha nova; nenhuma dívida resolvida esquecida no baseline`, async () => {
      const { theme, fallback } = resolveThemeDefinition(key);
      expect(fallback, `${key} caiu no fallback`).toBeNull();
      // Declaração de opções válida (W2): chave, tipo, padrão e escolhas.
      expect(validateThemeOptionFields(THEME_REGISTRY[key].manifest.options ?? []).errors, `opções de ${key}`).toEqual([]);
      const failures: string[] = [];
      mkdirSync(path.join(OUT_DIR, key), { recursive: true });
      for (const scenario of THEME_FIXTURE_SCENARIOS) {
        const model = buildFixtureRenderModel(theme, scenario);
        const body = await renderBody(model);
        expect(body).toContain('data-fixture-content=""');
        const file = `${key}/${scenario.name}.html`;
        writeFileSync(path.join(OUT_DIR, file), documentHtml(model, scenario, body));
        const result = check(model, scenario, body, file);
        failures.push(...result.failures);
        pages.push(result.page);
      }
      results.set(key, failures);
      if (updateBaseline) return;
      const allowed = new Set(recorded[key] ?? []);
      expect(failures.filter((failure) => !allowed.has(failure)), `falha nova no SSR de ${key}`).toEqual([]);
      // Dívida resolvida só reprova no CI do core (baseline sempre justo); no theme-check de um
      // repositório de tema (VENORE_THEME_KEYS) uma versão melhor do pacote não pode reprovar.
      const resolved = [...allowed].filter((failure) => !failures.includes(failure));
      if (process.env.VENORE_THEME_KEYS) {
        if (resolved.length > 0) console.warn(`${key}: dívida resolvida (encolher theme-ssr.baseline.json): ${resolved.join(", ")}`);
      } else {
        expect(resolved, `${key} melhorou: rode UPDATE_THEME_SSR_BASELINE=1 pra encolher o baseline`).toEqual([]);
      }
    });
  }

  it("o fallback (venore-slime) e todo tema v8 não têm dívida no harness", () => {
    const v8 = Object.entries(THEME_REGISTRY)
      .filter(([, entry]) => entry.contract === 8)
      .map(([key]) => key);
    expect(v8).toContain("venore-slime");
    expect(v8.filter((key) => (recorded[key] ?? []).length > 0)).toEqual([]);
  });
});
