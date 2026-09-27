import { eq, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { cacheVersions } from "@/infrastructure/database/platform-schema";

// Contador por namespace em platform.cache_versions — o jeito barato de invalidar um cache em
// memória em TODAS as instâncias (serverless/réplicas) sem Redis: quem escreve incrementa, quem
// lê compara com o último valor visto (ver rbac/user-context-cache.ts).
export async function bumpCacheVersion(namespace: string): Promise<void> {
  await db
    .insert(cacheVersions)
    .values({ namespace, version: 1 })
    .onConflictDoUpdate({
      target: cacheVersions.namespace,
      set: { version: sql`${cacheVersions.version} + 1`, updatedAt: sql`now()` },
    });
}

export async function readCacheVersion(namespace: string): Promise<number> {
  const [row] = await db
    .select({ version: cacheVersions.version })
    .from(cacheVersions)
    .where(eq(cacheVersions.namespace, namespace))
    .limit(1);
  return row?.version ?? 0;
}
