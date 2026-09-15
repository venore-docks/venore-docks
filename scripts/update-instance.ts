import { execSync } from "node:child_process";
import { ensureBaseRbacDataSeeded } from "@/contexts/rbac";
import { registerPlugins } from "@/platform/plugin-engine/register-plugins";
import { runPluginMigrations } from "@/platform/plugin-engine/run-plugin-migrations";
import { PLUGIN_REGISTRY } from "@/plugins/registry";

// Contraparte de install-fresh.ts pro caso "banco já existe, código acabou de ser atualizado"
// (docs/venore-docks.md — modelo fork+upstream): consolida em UM comando os passos que hoje eram
// espalhados em vários `npm run db:seed:*` + `db:apply-plugin-migrations -- <plugin>` manuais
// depois de um `git merge upstream/main`. Cada etapa já era idempotente isoladamente — só faltava
// alguém chamar todas juntas. Seguro rodar toda vez que a instância atualizar, mesmo sem nada novo
// pra aplicar.
//
//   1. migrations do core             (drizzle-kit migrate)
//   2. papéis/permissions base        (ensureBaseRbacDataSeeded) — cobre TODA permission nova que
//      entrar em contracts/base-role-permissions.ts daqui pra frente, sem precisar de um script
//      `seed-*-permission.mjs` novo por permission (os 6 que existiam hoje só reaplicam chaves que
//      já estão nessa lista — redundantes com este passo, mantidos por compatibilidade)
//   3. defaults de settings de plugin (registerPlugins)
//   4. migrations de cada plugin com schema já resolvido no registro (runPluginMigrations) — bump
//      de versão de um plugin já instalado não aplicava migration nova sozinho (gap documentado em
//      apply-plugin-migrations.ts); aqui roda pra TODOS os plugins do registro, não um por vez

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("\n✖ DATABASE_URL não está definida (confira o seu .env).");
    process.exit(1);
  }

  console.log("\n[1/4] Aplicando migrations do core…");
  execSync("npm run db:migrate", { stdio: "inherit" });

  console.log("\n[2/4] Garantindo papéis e permissions base do RBAC…");
  await ensureBaseRbacDataSeeded();

  console.log("\n[3/4] Registrando plugins (defaults de settings)…");
  const report = await registerPlugins();
  const active = report.entries.filter((entry) => entry.status === "active").map((entry) => entry.key);
  console.log(active.length ? `      plugins ativos: ${active.join(", ")}` : "      nenhum plugin ativo.");

  console.log("\n[4/4] Aplicando migrations pendentes de cada plugin com schema…");
  const withSchema = PLUGIN_REGISTRY.filter((entry) => entry.migrationsPath);
  if (withSchema.length === 0) {
    console.log("      nenhum plugin com migrationsPath declarado.");
  }
  let failed = false;
  for (const entry of withSchema) {
    const result = await runPluginMigrations(entry.key);
    if (!result.success) {
      console.error(`      ✖ ${entry.key}: ${result.error.message}`);
      failed = true;
      continue;
    }
    console.log(`      ✔ ${entry.key} em dia.`);
  }

  if (failed) {
    console.error("\n✖ Atualização concluída com falhas — veja as linhas ✖ acima.");
    process.exit(1);
  }

  console.log("\n✔ Atualização concluída.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
