import { expect, test } from "@playwright/test";

// Primeiro acesso de uma instância nova: /setup com SETUP_TOKEN cria o superadmin, e depois o
// login por senha funciona (e falha do jeito certo). Roda contra um banco vazio.
const setupToken = process.env.SETUP_TOKEN ?? "";
const email = `e2e-${Date.now()}@example.test`;
const password = "E2e-senha-segura-123";

test.describe.serial("primeiro acesso", () => {
  test.beforeAll(() => {
    expect(setupToken.length, "defina SETUP_TOKEN (16+ caracteres) pro E2E").toBeGreaterThanOrEqual(16);
  });

  test("anônimo não entra no admin", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Acesso negado" })).toBeVisible();
  });

  test("setup recusa token errado", async ({ page }) => {
    await page.goto("/setup", { waitUntil: "networkidle" });
    await page.getByPlaceholder("Token de configuração (SETUP_TOKEN)").fill("token-errado-000000000000");
    await page.getByPlaceholder("Nome").fill("Admin E2E");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Senha (mín. 8 caracteres)").fill(password);
    await page.getByRole("button", { name: "Criar superadmin" }).click();
    await expect(page.getByText("Token de configuração inválido.")).toBeVisible();
  });

  test("setup com o token cria o superadmin e entra no admin", async ({ page }) => {
    await page.goto("/setup", { waitUntil: "networkidle" });
    await page.getByPlaceholder("Token de configuração (SETUP_TOKEN)").fill(setupToken);
    await page.getByPlaceholder("Nome").fill("Admin E2E");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Senha (mín. 8 caracteres)").fill(password);
    await page.getByRole("button", { name: "Criar superadmin" }).click();
    await expect(page).toHaveURL(/\/admin/);
  });

  test("setup não roda de novo", async ({ page }) => {
    await page.goto("/setup");
    await expect(page.getByRole("button", { name: "Criar superadmin" })).toHaveCount(0);
  });

  test("login com senha errada mostra erro genérico", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.getByPlaceholder("Email ou usuário").fill(email);
    await page.getByPlaceholder("Senha", { exact: true }).fill("senha-errada-123");
    await page.getByRole("button", { name: "Entrar com senha" }).click();
    await expect(page).toHaveURL(/error=invalid-credentials/);
    await expect(page.getByText("Usuário ou senha inválidos.")).toBeVisible();
  });

  test("login com a senha certa volta pra página pedida", async ({ page }) => {
    await page.goto("/login?callbackUrl=%2Fadmin%2Fsettings", { waitUntil: "networkidle" });
    await page.getByPlaceholder("Email ou usuário").fill(email);
    await page.getByPlaceholder("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar com senha" }).click();
    await expect(page).toHaveURL(/\/admin\/settings/);
  });
});
