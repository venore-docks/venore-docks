import { defineConfig } from "vitest/config";
import baseConfig from "./vitest.config";

// Suíte do job `themes` do CI (spec v8 §10): SSR de todo tema do registro, contraste, orçamento.
// Esqueleto da Fase F — por ora roda os testes de tema já existentes (registro, contrato de
// tokens, paridade do slime, codegen). Dono do corpo: W10 (theme-ssr.harness, budget, HTML/CSS
// pro Playwright de playwright.themes.config.ts).
// Sem mergeConfig: ele concatenaria o `include` com o `src/**` do config base.
export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: [
      "src/themes/**/*.test.{ts,tsx}",
      "src/theme-sdk/**/*.test.{ts,tsx}",
      "src/platform/theme-rendering/**/*.test.{ts,tsx}",
    ],
  },
});
