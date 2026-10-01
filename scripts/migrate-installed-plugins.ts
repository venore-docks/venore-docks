import { listExtensionStates } from "@/contexts/extensions";
import { applyRestrictedUploadCategories } from "@/platform/media-lifecycle/apply-restricted-upload-categories";
import { runPluginMigrations } from "@/platform/plugin-engine/run-plugin-migrations";
import { PLUGIN_REGISTRY } from "@/plugins/registry";

// Passo do `prebuild` (logo depois do `drizzle-kit migrate` do core) — ou seja, roda em TODO
// deploy da Vercel. Fecha o buraco documentado em apply-plugin-migrations.ts: bump de tag de um
// plugin JÁ INSTALADO trazendo migration nova não aplicava nada sozinho (só o install roda
// migration de plugin), e instância na Vercel não tem onde rodar `npm run db:update`.
//
// Só plugin instalado (contexts/extensions): plugin presente no package.json mas nunca instalado
// continua sem schema até alguém clicar "Instalar" em /admin/plugins — o install segue sendo o
// dono da PRIMEIRA migration. O migrate() do drizzle-orm é idempotente (tabela de tracking própria
// por plugin), então build sem migration nova não faz nada.
//
// Falha de migration derruba o build de propósito (mesmo comportamento do migrate do core): subir
// código que já lê coluna nova sem o schema correspondente quebraria o plugin em produção; com o
// build vermelho a Vercel mantém o deploy anterior no ar.
async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("[plugins] ✖ DATABASE_URL não está definida — não dá pra aplicar migrations de plugin.");
    process.exit(1);
  }

  // Arquivos sensíveis de plugin (manifest.restrictedUploadCategories, ex: currículos): aplica a
  // restrição também ao que já foi enviado. Antes das migrations de plugin porque só depende do
  // schema de mídia do core (já migrado). Falha aqui não derruba o build — loga e segue.
  try {
    for (const { key, restricted } of await applyRestrictedUploadCategories()) {
      console.log(`[plugins] ✔ mídia restrita em "${key}": ${restricted} arquivo(s) ajustado(s).`);
    }
  } catch (error) {
    console.warn(`[plugins] ! não deu pra aplicar a mídia restrita: ${error instanceof Error ? error.message : String(error)}`);
  }

  const withSchema = PLUGIN_REGISTRY.filter((entry) => entry.migrationsPath);
  if (withSchema.length === 0) {
    console.log("[plugins] nenhum plugin com migrations no registro.");
    process.exit(0);
  }

  const states = await listExtensionStates({ kind: "plugin" });
  if (!states.success) {
    console.error(`[plugins] ✖ não deu pra ler quais plugins estão instalados: ${states.error.message}`);
    process.exit(1);
  }

  let failed = false;
  for (const entry of withSchema) {
    if (!states.data[entry.key]?.installed) {
      console.log(`[plugins] – ${entry.key}: não instalado, pulando (a migration roda no install).`);
      continue;
    }
    const result = await runPluginMigrations(entry.key);
    if (!result.success) {
      console.error(`[plugins] ✖ ${result.error.message}`);
      failed = true;
      continue;
    }
    console.log(`[plugins] ✔ ${entry.key}: migrations em dia.`);
  }

  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
