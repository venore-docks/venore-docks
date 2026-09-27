import { desc, eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { assets } from "../../../database/schema";
import type { OwnMediaAssetSummary } from "./types";

export async function findAssetsUploadedBy(userId: string): Promise<OwnMediaAssetSummary[]> {
  return db
    .select({
      id: assets.id,
      filename: assets.filename,
      contentType: assets.contentType,
      size: assets.size,
      visibility: assets.visibility,
      createdAt: assets.createdAt,
      deletedAt: assets.deletedAt,
    })
    .from(assets)
    .where(eq(assets.uploadedBy, userId))
    .orderBy(desc(assets.createdAt));
}
