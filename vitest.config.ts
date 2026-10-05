import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Espelha os `paths` do tsconfig. O SDK de plugin (`@venore/plugin-sdk`) é hoje um alias pra
    // src/sdk/* (ver docs/plugins-repos-separados-plano.md) — vira pacote de verdade na extração.
    alias: [
      { find: /^@venore\/plugin-sdk$/, replacement: fileURLToPath(new URL("./src/sdk/index.ts", import.meta.url)) },
      { find: /^@venore\/plugin-sdk\/(.*)$/, replacement: fileURLToPath(new URL("./src/sdk/", import.meta.url)) + "$1.ts" },
      { find: /^@venore\/theme-sdk$/, replacement: fileURLToPath(new URL("./src/theme-sdk/index.ts", import.meta.url)) },
      { find: /^@venore\/theme-sdk\/(.*)$/, replacement: fileURLToPath(new URL("./src/theme-sdk/", import.meta.url)) + "$1.ts" },
      // "@venore/plugin-sdk" reexporta getPluginAdminPageData -> @/contexts/auth -> auth.config.ts
      // (NextAuth({...}) no top-level) -> next-auth -> "next/server", subpath que não resolve fora
      // do bundler do Next. Qualquer teste UNITÁRIO de plugin que importa o barrel do SDK esbarra
      // nisso; nenhum exercita next-auth de verdade. Mesmo stub e racional do config de integração.
      {
        find: /^server-only$/,
        replacement: fileURLToPath(new URL("./src/test-support/stubs/server-only.ts", import.meta.url)),
      },
      {
        find: /^next-auth$/,
        replacement: fileURLToPath(new URL("./src/test-support/stubs/next-auth.ts", import.meta.url)),
      },
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
    ],
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: [...configDefaults.exclude, "src/**/*.integration.test.{ts,tsx}"],
    passWithNoTests: true,
    env: loadEnv("", process.cwd(), ""),
    // fileParallelism: false (implícito no projeto) + vários plugins sincronizados num único
    // processo: o PRIMEIRO `await import()` de um módulo que puxa um grafo grande (SDK + contexts)
    // pode passar de 5s só de transform, sem ser um hang. 20s dá folga sem esconder um travamento
    // de verdade.
    testTimeout: 20000,
  },
});
