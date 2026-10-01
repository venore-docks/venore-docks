import { createInterface } from "node:readline/promises";
import { activateUser, findUserByEmail } from "@/contexts/auth";
import { grantSuperadmin, superadminExists } from "@/contexts/rbac";

// Script de bootstrap (docs/venore-docks.md — Autenticação / Bootstrap de superadmin), para
// instâncias que já têm usuários mas nenhum superadmin (caso de migração, não instalação nova
// — instalação nova é coberta automaticamente por platform/registration/handle-user-registered.ts).
//
// Diferente dos outros scripts em scripts/ (seed-*-permission.mjs, que rodam sem argumento e sem
// confirmação — baixo risco, só afetam o que um papel já existente pode fazer): este script
// promove alguém a controle irrestrito do sistema, então é a exceção deliberada — recebe o email
// por argumento (nunca constante fixa) e sempre pede confirmação interativa antes de escrever.
async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Uso: npm run db:bootstrap-superadmin -- <email>");
    process.exit(1);
  }

  const userResult = await findUserByEmail({ email });
  if (!userResult.success) {
    console.error(
      `Não foi possível encontrar um usuário com o email "${email}": ${userResult.error.message}\n` +
        "A pessoa precisa ter feito login pelo menos uma vez antes de rodar este script.",
    );
    process.exit(1);
  }
  const user = userResult.data;

  const existsResult = await superadminExists();
  if (!existsResult.success) {
    console.error(`Não foi possível verificar se já existe um superadmin: ${existsResult.error.message}`);
    process.exit(1);
  }
  if (existsResult.data) {
    console.error(
      "Já existe um superadmin no sistema — este script só promove o primeiro.\n" +
        "Para conceder o papel a mais alguém, use a tela /admin/rbac (ou assignRoleToUser).",
    );
    process.exit(1);
  }

  console.log("Usuário a promover:");
  console.log(`  id:    ${user.id}`);
  console.log(`  nome:  ${user.name ?? "(sem nome)"}`);
  console.log(`  email: ${user.email}`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question("\nConfirma promover este usuário a superadmin? (s/N) ");
  rl.close();

  if (answer.trim().toLowerCase() !== "s") {
    console.log("Abortado — nenhuma alteração feita.");
    process.exit(0);
  }

  // bypassExistsCheck: este script já checou superadminExists acima e pediu confirmação
  // interativa — é o único caminho autorizado a pular a re-checagem do handler (P1).
  const grantResult = await grantSuperadmin({ userId: user.id, bypassExistsCheck: true });
  if (!grantResult.success) {
    console.error(`Falha ao promover o usuário: ${grantResult.error.message}`);
    process.exit(1);
  }

  // A conta pode estar "pending" (cadastro aguardando aprovação) — o superadmin precisa entrar.
  const activated = await activateUser({ userId: user.id, reason: "bootstrap" });
  if (!activated.success) {
    console.error(`Superadmin concedido, mas falhou ao liberar a conta: ${activated.error.message}`);
    process.exit(1);
  }

  console.log(`Usuário "${user.email}" promovido a superadmin.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
