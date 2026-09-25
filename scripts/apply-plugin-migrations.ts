import { runPluginMigrations } from "@/platform/plugin-engine/run-plugin-migrations";
import { PLUGIN_REGISTRY } from "@/plugins/registry";

// Stopgap manual pra um buraco real: runPluginMigrations só rodava dentro de installPlugin
// (src/platform/plugin-engine/install-plugin.ts), que PULA a migration inteira quando o plugin já
// está marcado como instalado ("idempotente — não reexecuta migration"). Ou seja: atualizar a
// versão de um plugin já instalado (npm install de uma tag nova, com migrations novas no pacote)
// não aplicava essas migrations sozinho. Hoje o build cobre isso pra todo plugin instalado
// (scripts/migrate-installed-plugins.ts no prebuild); este script fica pra rodar um plugin
// específico na mão (ex: local, sem build).
//
// runPluginMigrations em si NÃO tem essa trava — só o installPlugin tem. Chamar direto aqui é
// seguro mesmo com o plugin já instalado: o migrate() do drizzle-orm já é idempotente (só aplica o
// que ainda não está registrado na tabela de tracking própria do plugin, ex:
// broadcast_migrations.__drizzle_migrations) — rodar de novo não repete nem quebra nada.
//
// Uso: npm run db:apply-plugin-migrations -- <pluginKey>  (ex: broadcast)
async function main() {
  const pluginKey = process.argv[2];
  if (!pluginKey) {
    console.error("Uso: npm run db:apply-plugin-migrations -- <pluginKey>");
    console.error(`Plugins no registro: ${PLUGIN_REGISTRY.map((entry) => entry.key).join(", ") || "(nenhum)"}`);
    process.exit(1);
  }

  console.log(`Aplicando migrations pendentes de "${pluginKey}"...`);
  const result = await runPluginMigrations(pluginKey);
  if (!result.success) {
    console.error(`Falha: ${result.error.message}`);
    process.exit(1);
  }

  console.log(`OK — migrations de "${pluginKey}" em dia.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
