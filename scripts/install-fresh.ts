import { execSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { db } from "@/infrastructure/database/client";
// Insert cru em auth.users: não existe API pública pra criar usuário (docs/venore-docks.md —
// exceção conhecida à regra de store.ts; mesmo acesso cru que src/test-support usa). Todo o resto
// do script passa por barrel público de context.
import { users } from "@/contexts/auth/database/schema";
import { activateUser, adminSetUserPassword, findUserByEmail } from "@/contexts/auth";
import { ensureBaseRbacDataSeeded, grantSuperadmin, superadminExists } from "@/contexts/rbac";
import { registerPlugins } from "@/platform/plugin-engine/register-plugins";

// Instalação nova (I7/P13): leva um banco vazio + DATABASE_URL + AUTH_SECRET até um primeiro
// superadmin capaz de logar por senha, sem depender de OAuth nem de uma tela de primeiro usuário.
// Ordem determinística:
//   1. migrations do core          (drizzle-kit migrate)
//   2. dado base de RBAC           (ensureBaseRbacDataSeeded — papéis + permissions do "admin")
//   3. registro de plugins         (registerPlugins — defaults de settings de plugin ativo)
//   4. primeiro usuário + senha    (auth: insert + admin-set-user-password) e superadmin
//
// Idempotente onde dá: 1–3 já são idempotentes por natureza; um usuário com o mesmo email é
// reaproveitado (senha reescrita). Aborta com mensagem clara se já houver um superadmin — nesse
// ponto a instalação já aconteceu e promover outro superadmin é trabalho de /admin/rbac.

const MIN_PASSWORD_LENGTH = 8;

function fail(message: string): never {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

async function resolveCredentials(): Promise<{ email: string; password: string }> {
  // Prioridade: argumentos posicionais > env (INSTALL_ADMIN_EMAIL/INSTALL_ADMIN_PASSWORD, úteis
  // em CI) > prompt interativo.
  let email = process.argv[2]?.trim() || process.env.INSTALL_ADMIN_EMAIL?.trim() || "";
  let password = process.argv[3] || process.env.INSTALL_ADMIN_PASSWORD || "";

  if (!email || !password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      if (!email) email = (await rl.question("Email do primeiro superadmin: ")).trim();
      if (!password) password = await rl.question("Senha (mín. 8 caracteres): ");
    } finally {
      rl.close();
    }
  }

  if (!email) fail("Email é obrigatório.");
  if (!email.includes("@")) fail(`"${email}" não parece um email válido.`);
  if (password.length < MIN_PASSWORD_LENGTH) {
    fail(`A senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }

  return { email, password };
}

async function main() {
  if (!process.env.DATABASE_URL) fail("DATABASE_URL não está definida (confira o seu .env).");

  const { email, password } = await resolveCredentials();

  console.log("\n[1/4] Aplicando migrations do core…");
  execSync("npm run db:migrate", { stdio: "inherit" });

  console.log("\n[2/4] Semeando papéis e permissions base do RBAC…");
  await ensureBaseRbacDataSeeded();

  console.log("\n[3/4] Registrando plugins (defaults de settings)…");
  const report = await registerPlugins();
  const active = report.entries.filter((entry) => entry.status === "active").map((entry) => entry.key);
  console.log(active.length ? `      plugins ativos: ${active.join(", ")}` : "      nenhum plugin ativo.");

  console.log("\n[4/4] Criando o primeiro superadmin…");
  const existing = await superadminExists();
  if (!existing.success) fail(`Não foi possível verificar superadmins existentes: ${existing.error.message}`);
  if (existing.data) {
    fail(
      "Já existe um superadmin — a instalação inicial já foi feita.\n" +
        "  Para promover outra pessoa, use /admin/rbac ou `npm run db:bootstrap-superadmin -- <email>`.",
    );
  }

  // Reaproveita um usuário já criado com esse email (re-execução parcial), senão cria um novo.
  const found = await findUserByEmail({ email });
  let userId: string;
  if (found.success) {
    userId = found.data.id;
    console.log(`      usuário "${email}" já existia (id ${userId}) — a senha será redefinida.`);
  } else {
    const [row] = await db.insert(users).values({ email, status: "approved" }).returning({ id: users.id });
    userId = row.id;
    console.log(`      usuário "${email}" criado (id ${userId}).`);
  }

  const passwordResult = await adminSetUserPassword({
    targetUserId: userId,
    newPassword: password,
    bypassAuthorization: true,
  });
  if (!passwordResult.success) fail(`Falha ao definir a senha: ${passwordResult.error.message}`);

  const grant = await grantSuperadmin({ userId, bypassExistsCheck: true });
  if (!grant.success) fail(`Falha ao conceder superadmin: ${grant.error.message}`);

  // Conta reaproveitada pode estar "pending" (default do schema é fail-closed).
  const activated = await activateUser({ userId, reason: "bootstrap" });
  if (!activated.success) fail(`Falha ao liberar a conta: ${activated.error.message}`);

  console.log(`\n✔ Instalação concluída. Faça login em /login com "${email}" e a senha definida.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
