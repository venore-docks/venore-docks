import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Overflow horizontal a 390 px (B, critério global): em nenhuma rota pública nem em /admin/* o
// documento pode ser mais largo que a janela (`scrollWidth <= innerWidth`). Roda depois do
// setup-and-login (prefixo "zz-" mantém a ordem alfabética) e, pra entrar no /admin, usa o admin
// da própria execução ou E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD. Sem credencial, as rotas de /admin
// são checadas como anônimo (tela "Acesso negado") — melhor que nada, mas só vale de verdade logado.
// Rotas públicas extras (plugins) entram por E2E_EXTRA_ROUTES="/galerias,/recursos-humanos/aniversariantes".
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const ADMIN_DIR = join(process.cwd(), "src", "app", "(platform)", "admin");

// Páginas estáticas de /admin (sem segmento dinâmico, que exigiria dado específico).
function adminRoutes(): string[] {
  const routes: string[] = [];
  const walk = (dir: string, url: string) => {
    if (existsSync(join(dir, "page.tsx"))) routes.push(url);
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (/^[[(@_]/.test(entry.name)) continue; // [id], (grupo), @slot, _components
      walk(join(dir, entry.name), `${url}/${entry.name}`);
    }
  };
  walk(ADMIN_DIR, "/admin");
  return routes.sort();
}

const PUBLIC_ROUTES = ["/", "/login", "/offline", ...(process.env.E2E_EXTRA_ROUTES?.split(",").map((route) => route.trim()).filter(Boolean) ?? [])];

async function expectNoHorizontalOverflow(page: Page, route: string) {
  await page.goto(route, { waitUntil: "networkidle" });
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, `${route}: scrollWidth ${scrollWidth} > innerWidth ${innerWidth}`).toBeLessThanOrEqual(innerWidth);
}

test.describe("sem overflow horizontal a 390 px", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`público ${route}`, async ({ page }) => {
      await expectNoHorizontalOverflow(page, route);
    });
  }

  test.describe("admin", () => {
    test.beforeEach(async ({ page }) => {
      const email = process.env.E2E_ADMIN_EMAIL;
      const password = process.env.E2E_ADMIN_PASSWORD;
      if (!email || !password) return;
      await page.goto("/login?callbackUrl=%2Fadmin", { waitUntil: "networkidle" });
      await page.getByPlaceholder("Email ou usuário").fill(email);
      await page.getByPlaceholder("Senha", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Entrar com senha" }).click();
      await expect(page).toHaveURL(/\/admin/);
    });

    for (const route of adminRoutes()) {
      test(`admin ${route}`, async ({ page }) => {
        await expectNoHorizontalOverflow(page, route);
      });
    }
  });
});
