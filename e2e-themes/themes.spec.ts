import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { browserPages, pageHtml, pageId, readBaseline, readManifest, ROOT, type BrowserPage } from "./pages";
import { A11Y_RESULTS_DIR, SCREENSHOT_DIR } from "./ssr-output";

// Gate visual/a11y dos temas (spec v8 §10, job `themes`). Determinístico: HTML do harness SSR via
// setContent (sem rede, sem JS do app), viewport fixo, reduced motion.
//   - overflow horizontal 0 (390 e 1280): gate duro no kit v8 (slime); Shell 7.x entra no baseline;
//   - landmarks, teclado e axe (wcag2a/aa, contraste agrupado por região): comparados com
//     e2e-themes/a11y-baseline.json (dívida dos Shells 7.x). Problema novo falha; dívida resolvida
//     vira anotação (UPDATE_THEME_A11Y_BASELINE=1 encolhe o baseline);
//   - screenshot de toda página vai pro artefato do CI — nunca comparada pixel a pixel.

const manifest = readManifest();
const baseline = readBaseline();
const MAX_TABS = 80;

type FocusStep = {
  tag: string;
  isSkipLink: boolean;
  inNav: boolean;
  isMobileToggle: boolean;
  visible: boolean;
  focusRing: boolean;
};

// Um Tab e a descrição do elemento focado (null = foco voltou pro documento).
async function tab(page: Page, bottomBar: boolean): Promise<FocusStep | null> {
  await page.keyboard.press("Tab");
  return page.evaluate((bottomBarMode) => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body || element === document.documentElement) return null;
    const href = element.getAttribute("href") ?? "";
    const main = document.querySelector("main");
    const isSkipLink = element.tagName === "A" && href.startsWith("#") && href.length > 1 && main?.id === href.slice(1);
    const nav = element.closest("nav");
    const header = element.closest("header, #site-header");
    const isMobileToggle = bottomBarMode
      ? Boolean(element.tagName === "BUTTON" && element.closest("nav[data-mobile-nav='bottom-bar']"))
      : Boolean(element.tagName === "BUTTON" && header && element.hasAttribute("aria-expanded") && !element.closest("nav"));
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const visible = rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && Number(style.opacity) > 0;
    const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
    const shadow = style.boxShadow !== "none" && style.boxShadow !== "";
    return {
      tag: element.tagName.toLowerCase(),
      isSkipLink,
      inNav: Boolean(nav) && element.tagName === "A",
      isMobileToggle,
      visible,
      focusRing: outline || shadow,
    };
  }, bottomBar);
}

async function keyboardIssues(page: Page, target: BrowserPage, mobile: boolean): Promise<string[]> {
  const issues: string[] = [];
  const bottomBar = target.mobileNav === "bottom-bar";
  const steps: FocusStep[] = [];
  for (let index = 0; index < MAX_TABS; index++) {
    const step = await tab(page, bottomBar);
    if (!step) break;
    steps.push(step);
  }
  if (!steps[0]?.isSkipLink) issues.push("keyboard:skip-link-first");
  const navIndex = steps.findIndex((step) => step.inNav && step.visible);
  if (navIndex < 0) issues.push("keyboard:nav-link");
  if (mobile) {
    const toggleIndex = steps.findIndex((step) => step.isMobileToggle && step.visible);
    if (toggleIndex < 0) {
      issues.push("keyboard:mobile-toggle");
    } else if (!steps[toggleIndex].focusRing) {
      issues.push("keyboard:mobile-toggle-focus-ring");
    }
  }
  if (steps.some((step) => !step.visible && !step.isSkipLink)) issues.push("keyboard:focus-on-hidden");
  return issues;
}

async function landmarkIssues(page: Page): Promise<string[]> {
  const issues: string[] = [];
  if ((await page.getByRole("main").count()) !== 1) issues.push("landmark:main");
  if ((await page.getByRole("banner").count()) !== 1) issues.push("landmark:banner");
  if ((await page.getByRole("contentinfo").count()) !== 1) issues.push("landmark:contentinfo");
  if ((await page.getByRole("navigation").count()) < 1) issues.push("landmark:navigation");
  return issues;
}

// axe wcag2a/aa; cada violação vira `axe:<regra>@<região>` (região = data-region do kit, senão o
// landmark mais próximo) — o contraste fica medido POR REGIÃO, como o checador de tokens do W1.
async function axeIssues(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const issues = new Set<string>();
  for (const violation of results.violations) {
    for (const node of violation.nodes) {
      const selector = String(node.target[0]);
      const region = await page.evaluate((css) => {
        const element = document.querySelector(css);
        if (!element) return "page";
        const marked = element.closest("[data-region]");
        if (marked) return marked.getAttribute("data-region") ?? "page";
        const landmark = element.closest("header, nav, main, aside, footer");
        return landmark ? landmark.tagName.toLowerCase() : "page";
      }, selector);
      issues.add(`axe:${violation.id}@${region}`);
    }
  }
  return [...issues];
}

if (!manifest) {
  test("harness SSR gerou as páginas", () => {
    throw new Error("Sem test-results/themes-ssr/manifest.json — rode o harness SSR antes (ver global-setup.ts).");
  });
} else {
  for (const target of browserPages(manifest)) {
    test(`${target.theme} — ${target.scenario} — ${target.mode}`, async ({ page }, testInfo) => {
      const viewport = testInfo.project.name;
      const mobile = viewport === "mobile";
      const id = pageId(target, viewport);
      await page.emulateMedia({ colorScheme: target.mode, reducedMotion: "reduce" });
      await page.setContent(pageHtml(target), { waitUntil: "load" });

      // Overflow horizontal: gate duro no kit v8; num Shell 7.x (markup do pacote) vira dívida
      // `overflow` no baseline, como o resto.
      const overflow = await page.evaluate(() => ({
        scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        innerWidth: window.innerWidth,
      }));
      const overflows = overflow.scrollWidth > overflow.innerWidth;
      if (!target.legacy) {
        expect(overflow.scrollWidth, `overflow horizontal em ${target.theme} ${id}`).toBeLessThanOrEqual(overflow.innerWidth);
      }

      const issues = [
        ...(overflows ? ["overflow"] : []),
        ...(await landmarkIssues(page)),
        ...(await axeIssues(page)),
        ...(await keyboardIssues(page, target, mobile)),
      ].sort();

      const screenshotPath = path.join(ROOT, SCREENSHOT_DIR, target.theme, `${target.scenario}-${viewport}-${target.mode}.png`);
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.screenshot({ path: screenshotPath, fullPage: true, animations: "disabled" });

      const resultDir = path.join(ROOT, A11Y_RESULTS_DIR);
      mkdirSync(resultDir, { recursive: true });
      writeFileSync(
        path.join(resultDir, `${target.theme}__${id.replace(/\//g, "__")}.json`),
        JSON.stringify({ theme: target.theme, pageId: id, issues }),
      );

      if (process.env.UPDATE_THEME_A11Y_BASELINE === "1") return;
      const allowed = new Set(baseline[target.theme]?.[id] ?? []);
      const fixed = [...allowed].filter((issue) => !issues.includes(issue));
      if (fixed.length > 0) {
        testInfo.annotations.push({ type: "baseline", description: `resolvido (encolher o baseline): ${fixed.join(", ")}` });
      }
      expect(issues.filter((issue) => !allowed.has(issue)), `problema novo de a11y em ${target.theme} ${id}`).toEqual([]);
    });
  }
}
