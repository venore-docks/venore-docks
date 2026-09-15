import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { assets } from "../../../database/schema";

export async function countAssetsByUploader(uploaderId: string): Promise<number> {
  const rows = await db.select({ id: assets.id }).from(assets).where(eq(assets.uploadedBy, uploaderId));
  return rows.length;
}
