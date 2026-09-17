import { sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { extensionState } from "../../database/schema";
import type { ExtensionKind, ExtensionStateRecord } from "../../contracts/types";

// Marca a extensão como instalada. Idempotente: `installed_at` só é gravado uma vez
// (COALESCE preserva o timestamp original numa reinstalação). Nunca limpa `installed_at` — a
// desinstalação "modo B" (limpar banco) é atômica com o DROP SCHEMA do plugin e mora no ponto de
// composição src/platform/plugin-engine/uninstall-plugin.ts, que faz o UPDATE de "não instalado"
// por fora deste store (numa transação).
export async function upsertExtensionInstalled(
  kind: ExtensionKind,
  key: string,
  updatedByUserId: string,
): Promise<ExtensionStateRecord> {
  const [row] = await db
    .insert(extensionState)
    .values({ kind, key, installedAt: sql`now()`, updatedByUserId })
    .onConflictDoUpdate({
      target: [extensionState.kind, extensionState.key],
      set: {
        installedAt: sql`coalesce(${extensionState.installedAt}, now())`,
        updatedByUserId,
        updatedAt: sql`now()`,
      },
    })
    .returning();

  return row;
}
