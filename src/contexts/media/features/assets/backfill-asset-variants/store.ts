import { and, asc, count, isNull } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { assets } from "../../../database/schema";

// Nunca processado (ou falhou da última vez). Soft-deletado fica de fora: vai pro purge, não
// adianta gastar storage com variante dele.
const pending = and(isNull(assets.variantsProcessedAt), isNull(assets.deletedAt));

export async function findAssetIdsPendingVariants(limit: number): Promise<string[]> {
  const rows = await db.select({ id: assets.id }).from(assets).where(pending).orderBy(asc(assets.createdAt), asc(assets.id)).limit(limit);
  return rows.map((row) => row.id);
}

export async function countAssetsPendingVariants(): Promise<number> {
  const [row] = await db.select({ total: count() }).from(assets).where(pending);
  return row?.total ?? 0;
}
