import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { contentFeedConnections } from "../../../database/schema";
import { findCategoryIdsForConnection } from "../../../database/connection-categories";
import type { ContentFeedConnectionRecord } from "../../../contracts/types";

// Chave em texto plano, comparada em tempo constante (mesmo racional de
// broadcast.diagnosticsAgentKey no plugin broadcast) — o blast radius de um vazamento é limitado
// (só entries já publicadas/públicas, nas categorias liberadas pra essa conexão). Compara contra
// TODAS as conexões (não um único segredo global): todo `key` nasce de crypto.randomUUID(), então
// todas têm o mesmo comprimento — o length-check abaixo não vaza informação sobre qual conexão
// bateria, só descarta comparações com a chave fornecida de tamanho diferente.
export async function findConnectionByKey(providedKey: string): Promise<ContentFeedConnectionRecord | null> {
  const rows = await db.select().from(contentFeedConnections);
  const providedBuffer = Buffer.from(providedKey);

  for (const row of rows) {
    const storedBuffer = Buffer.from(row.key);
    if (storedBuffer.length !== providedBuffer.length) continue;
    if (timingSafeEqual(storedBuffer, providedBuffer)) {
      const categoryIds = await findCategoryIdsForConnection(row.id);
      return { ...row, categoryIds };
    }
  }

  return null;
}

export async function touchConnectionLastUsed(connectionId: string): Promise<void> {
  await db.update(contentFeedConnections).set({ lastUsedAt: new Date() }).where(eq(contentFeedConnections.id, connectionId));
}
