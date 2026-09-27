import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

function positiveIntFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

// Limites do pool, ajustáveis por env:
// - max: na Vercel cada instância da função tem o próprio pool — 10 conexões por instância
//   esgotavam o Postgres com poucas instâncias quentes; lá o padrão é 5.
// - connectionTimeoutMillis: sem ele, com o banco saturado um request esperava conexão pra sempre.
// - statement_timeout: só no runtime do Next (NEXT_RUNTIME existe no código compilado pelo Next).
//   Scripts rodados com tsx — migrations do prebuild, db:update — ficam sem limite, porque uma
//   migration longa não pode ser cortada no meio. DATABASE_STATEMENT_TIMEOUT_MS=0 desliga.
function poolConfig(): PoolConfig {
  const config: PoolConfig = {
    connectionString: process.env.DATABASE_URL,
    max: positiveIntFromEnv("DATABASE_POOL_MAX", process.env.VERCEL ? 5 : 10),
    idleTimeoutMillis: positiveIntFromEnv("DATABASE_POOL_IDLE_MS", 10_000),
    connectionTimeoutMillis: positiveIntFromEnv("DATABASE_CONNECT_TIMEOUT_MS", 10_000),
  };
  const statementTimeout = positiveIntFromEnv("DATABASE_STATEMENT_TIMEOUT_MS", 30_000);
  if (process.env.NEXT_RUNTIME && statementTimeout > 0) {
    config.statement_timeout = statementTimeout;
  }
  return config;
}

const pool = new Pool(poolConfig());
attachDatabasePool(pool);

export const db = drizzle({ client: pool });
