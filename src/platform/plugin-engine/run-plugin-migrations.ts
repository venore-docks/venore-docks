import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
// Import direto do client de infra (não de um store de context): é plumbing — não existe um
// context "dono" de "rodar migration arbitrária de plugin", e o alvo (PLUGIN_REGISTRY +
// manifesto) só é conhecido em platform/. Mesma natureza de src/observability/flush.ts, e o
// boundary de lint não restringe platform/ -> infrastructure/. NUNCA abrir um Pool próprio aqui
// (AGENTS.md seção 2) — o singleton já existe.
import { db } from "@/infrastructure/database/client";
import { beginOperation, endOperation } from "@/observability";
import type { OperationResult } from "@/shared/types";
import { PLUGIN_REGISTRY } from "@/plugins/registry";

// Deriva o schema de tracking a partir da key quando o manifesto não declara: "-" -> "_" e
// sufixo "_migrations" (ex: "enrollment-dashboard" -> "enrollment_dashboard_migrations"). É o
// mesmo valor que o drizzle.config.ts de cada plugin usa — tabela de tracking própria pra o
// migrate() do drizzle-orm não compartilhar o cursor "última migration aplicada" com o core.
function resolveMigrationsSchema(pluginKey: string, declared: string | undefined): string {
  return declared ?? `${pluginKey.replace(/-/g, "_")}_migrations`;
}

// Aplica a árvore de migrations própria do plugin (docs/venore-docks.md — "Schema e migrations").
// Chamado no install (platform/plugin-engine/install-plugin.ts) e, pra plugin JÁ instalado, no
// build (scripts/migrate-installed-plugins.ts, via prebuild — aplica migration nova de um bump de
// tag). Falha de migration retorna erro sem lançar — quem chama decide não marcar o plugin como
// instalado / derrubar o build.
export async function runPluginMigrations(pluginKey: string): Promise<OperationResult<{ pluginKey: string }>> {
  const manifest = PLUGIN_REGISTRY.find((entry) => entry.key === pluginKey);
  if (!manifest) {
    return {
      success: false,
      error: { code: "plugin-engine.migrations.unknown_plugin", message: `Plugin "${pluginKey}" não está no registro.` },
    };
  }
  if (!manifest.migrationsPath) {
    return {
      success: false,
      error: {
        code: "plugin-engine.migrations.not_declared",
        message: `Plugin "${pluginKey}" não declara migrationsPath no manifesto.`,
      },
    };
  }

  const handle = beginOperation({
    useCase: "platform.plugin-engine.run-plugin-migrations",
    actor: { id: "system", type: "system" },
    kind: "write",
  });

  // O plugin é um pacote npm `@venore/plugin-<key>`; a árvore de migrations vem junto no pacote
  // (`exports["./migrations/*"]`). Roda em Node no install — resolve direto no node_modules do
  // host (require.resolve com specifier dinâmico quebraria o bundle do turbopack).
  const pluginPackageDir = path.join(process.cwd(), "node_modules", "@venore", `plugin-${pluginKey}`);
  const migrationsFolder = path.resolve(pluginPackageDir, manifest.migrationsPath);
  const migrationsSchema = resolveMigrationsSchema(pluginKey, manifest.migrationsSchema);
  const migrationsTable = manifest.migrationsTable ?? "__drizzle_migrations";

  try {
    await migrate(db, { migrationsFolder, migrationsSchema, migrationsTable });
    endOperation(handle, { success: true });
    return { success: true, data: { pluginKey } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    endOperation(handle, {
      success: false,
      error: { code: "plugin-engine.migrations.failed", message },
    });
    return {
      success: false,
      error: { code: "plugin-engine.migrations.failed", message: `Falha ao aplicar migrations de "${pluginKey}": ${message}` },
    };
  }
}

export { resolveMigrationsSchema };
