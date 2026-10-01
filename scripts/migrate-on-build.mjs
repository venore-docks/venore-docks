// Migrations do build (prebuild): core (drizzle-kit migrate) e depois as dos plugins instalados.
//
// Em deploy de PREVIEW da Vercel (VERCEL_ENV=preview) NÃO roda por padrão: o preview costuma usar
// o mesmo DATABASE_URL da produção, e aplicar a migration de um branch ainda não aprovado mudava o
// schema de produção antes do merge (e sem volta). Pra rodar num preview que tem banco próprio,
// defina MIGRATE_ON_PREVIEW=true nas env vars de Preview. SKIP_DB_MIGRATIONS=true pula sempre
// (ex: pipeline que roda as migrations numa etapa de release separada).
//
// Guia de migrations compatíveis (expand/contract): docs/migrations-guia.md.
import { spawnSync } from "node:child_process";

const isPreview = process.env.VERCEL_ENV === "preview";
const optedIn = process.env.MIGRATE_ON_PREVIEW === "true";

if (process.env.SKIP_DB_MIGRATIONS === "true") {
  console.log("[migrate-on-build] SKIP_DB_MIGRATIONS=true — migrations puladas.");
  process.exit(0);
}
if (isPreview && !optedIn) {
  console.log(
    "[migrate-on-build] Deploy de preview: migrations NÃO aplicadas (defina MIGRATE_ON_PREVIEW=true se o preview tem banco próprio).",
  );
  process.exit(0);
}

for (const [command, args] of [
  ["npx", ["drizzle-kit", "migrate"]],
  ["npm", ["run", "db:migrate:plugins"]],
]) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    console.error(`[migrate-on-build] "${command} ${args.join(" ")}" falhou — build interrompido.`);
    process.exit(result.status ?? 1);
  }
}
