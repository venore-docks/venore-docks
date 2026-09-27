import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { currentTotpStep, totpAt } from "../src/contexts/auth/shared/totp";

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

  test("sair dos outros dispositivos derruba a outra sessão e mantém esta", async ({ browser }) => {
    const login = async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto("/login?callbackUrl=%2Fadmin", { waitUntil: "networkidle" });
      await page.getByPlaceholder("Email ou usuário").fill(email);
      await page.getByPlaceholder("Senha", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Entrar com senha" }).click();
      await expect(page).toHaveURL(/\/admin/);
      return { context, page };
    };
    const first = await login();
    const second = await login();

    await first.page.goto("/account", { waitUntil: "networkidle" });
    await first.page.getByRole("button", { name: "Sair dos outros dispositivos" }).click();
    await expect(first.page.getByRole("status").filter({ hasText: "As outras sessões foram encerradas." })).toBeVisible();

    await second.page.goto("/admin");
    await expect(second.page.getByRole("heading", { name: "Acesso negado" })).toBeVisible();

    // A sessão revogada tenta se renovar pelo endpoint de update do Auth.js — não pode voltar.
    const csrf = await (await second.page.request.get("/api/auth/csrf")).json();
    await second.page.request.post("/api/auth/session", { data: { csrfToken: csrf.csrfToken, data: {} } });
    await second.page.goto("/admin");
    await expect(second.page.getByRole("heading", { name: "Acesso negado" })).toBeVisible();
    await first.page.goto("/admin");
    await expect(first.page.getByRole("heading", { name: "Acesso negado" })).toHaveCount(0);

    await first.context.close();
    await second.context.close();
  });

  test("verificação em duas etapas: ativar, exigir no login e aceitar código de recuperação", async ({ page }) => {
    await page.goto("/login?callbackUrl=%2Faccount", { waitUntil: "networkidle" });
    await page.getByPlaceholder("Email ou usuário").fill(email);
    await page.getByPlaceholder("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar com senha" }).click();
    await expect(page).toHaveURL(/\/account/);

    await page.getByRole("button", { name: "Ativar verificação em duas etapas" }).click();
    const secret = (await page.locator("p.font-mono").innerText()).trim();
    await page.getByPlaceholder("Código de 6 dígitos").fill(totpAt(secret, currentTotpStep()));
    await page.getByRole("button", { name: "Ativar", exact: true }).click();
    await expect(page.getByText("Verificação em duas etapas ativada.")).toBeVisible();
    const recoveryCode = (await page.locator("ul.font-mono li").first().innerText()).trim();

    await page.context().clearCookies();
    await page.goto("/login?callbackUrl=%2Fadmin", { waitUntil: "networkidle" });
    await page.getByPlaceholder("Email ou usuário").fill(email);
    await page.getByPlaceholder("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar com senha" }).click();
    await expect(page).toHaveURL(/error=mfa_required/);

    await page.getByPlaceholder("Email ou usuário").fill(email);
    await page.getByPlaceholder("Senha", { exact: true }).fill(password);
    await page.getByPlaceholder("Código de verificação (se ativado)").fill(recoveryCode);
    await page.getByRole("button", { name: "Entrar com senha" }).click();
    await expect(page).toHaveURL(/\/admin/);
  });

  test("membro baixa os próprios dados e exclui a conta (LGPD)", async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    const member = `membro-${Date.now()}@example.test`;
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.locator("details summary").first().click();
    await page.getByPlaceholder("Nome").fill("Membro");
    await page.getByPlaceholder("Email", { exact: true }).fill(member);
    await page.locator('input[name="password"]').nth(1).fill("senha-membro-1");
    await page.getByRole("button", { name: /Criar conta/ }).click();
    await page.waitForURL(/notice=registration-received/);
    // Aprovação direto no banco (o fluxo de aprovação pelo admin tem teste próprio).
    execFileSync("psql", [process.env.DATABASE_URL ?? "", "-qc", `update auth.users set status='approved' where email='${member}'`]);

    await page.goto("/login?callbackUrl=%2Faccount", { waitUntil: "networkidle" });
    await page.getByPlaceholder("Email ou usuário").fill(member);
    await page.getByPlaceholder("Senha", { exact: true }).fill("senha-membro-1");
    await page.getByRole("button", { name: "Entrar com senha" }).click();
    await expect(page).toHaveURL(/\/account/);

    const exported = await (await page.request.get("/api/account/export")).json();
    expect(exported.account.email).toBe(member);
    expect(exported.account.passwordHash).toBeUndefined();

    await page.getByPlaceholder("Digite seu e-mail para confirmar").fill(member);
    await page.locator('form:has(button:has-text("Excluir minha conta")) input[name="password"]').fill("senha-membro-1");
    await page.getByRole("button", { name: "Excluir minha conta" }).click();
    await page.waitForURL((url) => url.pathname === "/");
    expect((await page.request.get("/api/account/export")).status()).toBe(401);
  });
});
