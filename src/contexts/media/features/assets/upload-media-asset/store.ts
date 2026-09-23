import { db } from "@/infrastructure/database/client";
import { assets } from "../../../database/schema";
import type { MediaAsset, MediaVisibility } from "../../../contracts/types";

export async function insertAsset(input: {
  filename: string;
  pathname: string;
  url: string;
  contentType: string;
  size: number;
  checksum: string;
  visibility: MediaVisibility;
  categoryId: string | null;
  uploadedBy: string | null;
}): Promise<MediaAsset> {
  const [row] = await db.insert(assets).values(input).returning();
  return row as MediaAsset;
}
