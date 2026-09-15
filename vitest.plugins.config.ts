import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { configDefaults, defineConfig } from "vitest/config";

// `npm test` (vitest.config.ts) só inclui "src/**" — os testes de um plugin instalado como git
// dependency (git+https://.../venore-plugin-X.git) vivem em node_modules/@venore/plugin-X/**, fora
// desse padrão, e o default exclude do vitest bane **/node_modules/** de qualquer forma. Resultado
// real observado: "testes passando" em rounds inteiros de trabalho num plugin nunca rodou a lógica
// do próprio plugin, só o test suite do host. `npm run test:plugins` fecha esse buraco.
//
// O include é montado a partir das dependencies "@venore/plugin-*" do package.json DESTE checkout
// (não um glob fixo tipo "../venore-plugin-*") — de propósito: um plugin cujo repo-irmão existe em
// disco mas NÃO é dependency da branch atual (ex: academy, birthdays, num checkout que só tem
// broadcast) nunca teve suas próprias deps instaladas aqui (abcjs, etc.) e falharia por motivo
// nenhum relacionado ao código. Rodar só o que está de fato instalado é o que garante um resultado
// que significa alguma coisa.
function pluginTestIncludes(): string[] {
  const pkg = JSON.parse(readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf-8")) as {
    dependencies?: Record<string, string>;
  };
  const pluginNames = Object.keys(pkg.dependencies ?? {})
    .filter((name) => name.startsWith("@venore/plugin-"))
    .map((name) => name.replace("@venore/plugin-", ""));
  return pluginNames.map((name) => `../venore-plugin-${name}/**/*.{test,spec}.{ts,tsx}`);
}

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@venore\/plugin-sdk$/, replacement: fileURLToPath(new URL("./src/sdk/index.ts", import.meta.url)) },
      { find: /^@venore\/plugin-sdk\/(.*)$/, replacement: fileURLToPath(new URL("./src/sdk/", import.meta.url)) + "$1.ts" },
      { find: /^@venore\/theme-sdk$/, replacement: fileURLToPath(new URL("./src/theme-sdk/index.ts", import.meta.url)) },
      { find: /^@venore\/theme-sdk\/(.*)$/, replacement: fileURLToPath(new URL("./src/theme-sdk/", import.meta.url)) + "$1.ts" },
      {
        find: /^next-auth$/,
        replacement: fileURLToPath(new URL("./src/test-support/stubs/next-auth.ts", import.meta.url)),
      },
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
    ],
  },
  test: {
    environment: "node",
    include: pluginTestIncludes(),
    // Mesma exclusão de vitest.config.ts (o host) pra *.integration.test — precisam de um
    // DATABASE_URL de verdade, não rodam aqui. Nenhum equivalente a test:integration pros plugins
    // ainda; cada integration test de plugin continua rodando do jeito que já rodava antes desta
    // config existir (se é que rodava em algum lugar).
    exclude: [
      ...configDefaults.exclude.filter((p) => p !== "**/node_modules/**"),
      "**/node_modules/**/node_modules/**",
      "../venore-plugin-*/**/*.integration.test.{ts,tsx}",
    ],
    passWithNoTests: true,
    env: loadEnv("", process.cwd(), ""),
    testTimeout: 20000,
  },
});
