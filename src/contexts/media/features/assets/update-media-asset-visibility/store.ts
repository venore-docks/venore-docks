import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { assets } from "../../../database/schema";
import type { MediaAsset, MediaVisibility } from "../../../contracts/types";

// Sem filtro de visibilidade/dono de propósito: quem decide se o ator pode agir é o service
// (dono OU media.manage), não o store.
export async function findAssetById(id: string): Promise<MediaAsset | null> {
  const [row] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  return (row as MediaAsset) ?? null;
}

export async function updateAssetVisibility(id: string, visibility: MediaVisibility, url: string): Promise<MediaAsset> {
  const [row] = await db.update(assets).set({ visibility, url, updatedAt: new Date() }).where(eq(assets.id, id)).returning();
  return row as MediaAsset;
}
