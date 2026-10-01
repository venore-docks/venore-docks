import { findAssetsUploadedBy } from "./store";
import type { ListOwnMediaAssetsResult } from "./types";

export async function listOwnMediaAssets(userId: string): Promise<ListOwnMediaAssetsResult> {
  return { success: true, data: await findAssetsUploadedBy(userId) };
}
