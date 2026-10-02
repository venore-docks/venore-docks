import { defineConfig } from "vitest/config";
import baseConfig from "./vitest.config";

// Suíte do job `themes` do CI (spec v8 §10, dono do corpo: W10): registro, contrato de tokens,
// contraste, orçamento de performance, paridade do slime, codegen, o pipeline de render e o harness
// SSR (src/themes/theme-ssr.harness.test.tsx), que grava o HTML de cada tema × cenário e o CSS do
// app compilado em test-results/themes-ssr/ pro Playwright (playwright.themes.config.ts). Também
// os fixtures/modelo da galeria (platform/theme-gallery) e a página /admin/themes/gallery.
// Sem mergeConfig: ele concatenaria o `include` com o `src/**` do config base.
export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: [
      "src/themes/**/*.test.{ts,tsx}",
      "src/theme-sdk/**/*.test.{ts,tsx}",
      "src/platform/theme-rendering/**/*.test.{ts,tsx}",
      "src/platform/theme-gallery/**/*.test.{ts,tsx}",
      "src/app/(platform)/admin/themes/gallery/**/*.test.{ts,tsx}",
    ],
  },
});
