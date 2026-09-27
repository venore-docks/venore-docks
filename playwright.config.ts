import { defineConfig, devices } from "@playwright/test";

// E2E do fluxo de primeiro acesso (setup + login). Precisa de: build pronto (`npm run build`),
// banco VAZIO com as migrations aplicadas (DATABASE_URL), AUTH_SECRET e SETUP_TOKEN no ambiente —
// ver o job `e2e` em .github/workflows/ci.yml. `npm run test:e2e` sobe o `next start` sozinho;
// E2E_BASE_URL aponta pra um servidor já rodando.
const port = Number(process.env.E2E_PORT ?? 3200);
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${port}`,
    trace: "retain-on-failure",
    ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${port}`,
        url: `http://localhost:${port}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
