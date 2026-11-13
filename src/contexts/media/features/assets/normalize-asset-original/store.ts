import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { assets } from "../../../database/schema";

export type OriginalSourceAsset = {
  id: string;
  filename: string;
  pathname: string;
  contentType: string;
};

export async function findOriginalSourceAsset(id: string): Promise<OriginalSourceAsset | null> {
  const [row] = await db
    .select({ id: assets.id, filename: assets.filename, pathname: assets.pathname, contentType: assets.contentType })
    .from(assets)
    .where(and(eq(assets.id, id), isNull(assets.deletedAt)))
    .limit(1);
  return row ?? null;
}

// O checksum passa a ser o dos bytes guardados: o export/import endereça arquivo por ele.
export async function updateNormalizedOriginal(
  id: string,
  values: { filename: string; contentType: string; size: number; checksum: string; width: number; height: number },
): Promise<void> {
  await db
    .update(assets)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(assets.id, id));
}
