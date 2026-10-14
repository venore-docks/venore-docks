import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@venore\/plugin-sdk$/, replacement: fileURLToPath(new URL("./src/sdk/index.ts", import.meta.url)) },
      { find: /^@venore\/plugin-sdk\/(.*)$/, replacement: fileURLToPath(new URL("./src/sdk/", import.meta.url)) + "$1.ts" },
      // @venore/theme-sdk (spec v8 §11) — mesmo alias do vitest.config.ts.
      { find: /^@venore\/theme-sdk$/, replacement: fileURLToPath(new URL("./src/theme-sdk/index.ts", import.meta.url)) },
      { find: /^@venore\/theme-sdk\/(.*)$/, replacement: fileURLToPath(new URL("./src/theme-sdk/", import.meta.url)) + "$1.ts" },
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
      // Só o especificador exato "next-auth" — next-auth/providers/* e next-auth/adapters
      // continuam resolvendo pro pacote real. Ver stubs/next-auth.ts.
      {
        find: /^next-auth$/,
        replacement: fileURLToPath(new URL("./src/test-support/stubs/next-auth.ts", import.meta.url)),
      },
    ],
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.{ts,tsx}"],
    passWithNoTests: true,
    env: loadEnv("", process.cwd(), ""),
    // Todos os arquivos de teste apontam pro mesmo banco descartável e o isolamento é por
    // TRUNCATE (ver AGENTS.md) — rodar arquivos em paralelo faz o beforeEach de um arquivo
    // truncar tabela que outro arquivo tem em uso no meio de um teste. Suíte sequencial evita a
    // corrida sem precisar de banco por worker.
    fileParallelism: false,
    // Aplica as duas árvores de migration num banco descartável antes da suíte (falha cedo se
    // TEST_DATABASE_URL não estiver definida — ver src/test-support/integration/global-setup.ts).
    globalSetup: ["./src/test-support/integration/global-setup.ts"],
    // Troca DATABASE_URL para TEST_DATABASE_URL dentro do processo de teste e faz TRUNCATE das
    // tabelas tocadas pelos seeds antes de cada teste (ver setup-env.ts).
    setupFiles: ["./src/test-support/integration/setup-env.ts"],
  },
});
