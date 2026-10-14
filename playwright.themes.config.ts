import { defineConfig } from "@playwright/test";

// Job `themes` do CI (spec v8 §10): sem banco, sem `next build`, sem servidor. O harness SSR
// (src/themes/theme-ssr.harness.test.tsx, via `vitest -c vitest.themes.config.ts`) grava o HTML de
// cada tema × cenário e o CSS do app compilado em test-results/themes-ssr/; esta suíte abre cada
// página com page.setContent a 390×844 e 1280×800, claro e escuro, e confere overflow horizontal,
// landmarks, teclado (skip link → navegação → botão mobile com anel de foco) e axe wcag2a/aa
// contra e2e-themes/a11y-baseline.json. Screenshots vão pra test-results/themes-screenshots/
// (artefato do CI, 14 dias) — NÃO são gate de pixel.
//
// Chromium: PLAYWRIGHT_CHROMIUM_PATH aponta um binário já instalado (mesma convenção de
// playwright.config.ts) quando a revisão do @playwright/test não bate com a do ambiente.
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./e2e-themes",
  // Fora de test-results/themes-ssr (o Playwright limpa o outputDir ao começar).
  outputDir: "test-results/themes-playwright",
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["html", { outputFolder: "playwright-report/themes", open: "never" }]] : "list",
  globalSetup: "./e2e-themes/global-setup.ts",
  globalTeardown: "./e2e-themes/global-teardown.ts",
  use: {
    reducedMotion: "reduce",
    colorScheme: "light",
    deviceScaleFactor: 1,
    ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
  },
  projects: [
    { name: "mobile", use: { browserName: "chromium", viewport: { width: 390, height: 844 } } },
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1280, height: 800 } } },
  ],
});
