import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { requireTestDatabaseUrl } from "./require-test-database-url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const CORE_MIGRATIONS_FOLDER = path.resolve(dirname, "../../../drizzle");
// Plugin é pacote npm `@venore/plugin-<key>` com a árvore de migrations dentro — mesmo caminho que
// platform/plugin-engine/run-plugin-migrations.ts resolve em produção (não src/plugins/, onde os
// plugins moravam antes de virar pacote).
const PLUGIN_PACKAGES_DIR = path.resolve(dirname, "../../../node_modules/@venore");

// Roda 1x antes da suíte inteira (contrato de globalSetup do Vitest), num Pool próprio — nunca o
// singleton de app/infrastructure/database/client.ts — porque a validação de TEST_DATABASE_URL
// precisa acontecer antes de qualquer módulo de app ser importado.
export default async function globalSetup(): Promise<void> {
  const connectionString = requireTestDatabaseUrl();
  const pool = new Pool({ connectionString });
  const db = drizzle({ client: pool });

  // Import dinâmico DEPOIS da validação da env var acima (o registro puxa os manifestos, que são
  // módulos de constante inofensivos, mas a ordem importa pra manter a garantia).
  const { PLUGIN_REGISTRY } = await import("@/plugins/registry");

  try {
    // Core primeiro (auth/rbac/cms/settings/observability/extensions), depois a árvore própria de
    // cada plugin que declara migrationsPath — mesma coisa que produção faz no install de cada
    // plugin (platform/plugin-engine/run-plugin-migrations.ts), aqui derivada do PLUGIN_REGISTRY
    // em vez de hardcode. migrationsSchema/migrationsTable dedicados por plugin: sem isso todos
    // compartilham "drizzle"."__drizzle_migrations", e o migrate() do drizzle-orm só compara o
    // created_at mais recente da tabela — uma migration de plugin mais antiga que a migration de
    // core mais recente seria pulada em silêncio.
    await migrate(db, { migrationsFolder: CORE_MIGRATIONS_FOLDER });

    for (const manifest of PLUGIN_REGISTRY) {
      if (!manifest.migrationsPath) continue;
      await migrate(db, {
        migrationsFolder: path.resolve(PLUGIN_PACKAGES_DIR, `plugin-${manifest.key}`, manifest.migrationsPath),
        migrationsSchema: manifest.migrationsSchema ?? `${manifest.key.replace(/-/g, "_")}_migrations`,
        migrationsTable: manifest.migrationsTable ?? "__drizzle_migrations",
      });
    }
  } finally {
    await pool.end();
  }
}
