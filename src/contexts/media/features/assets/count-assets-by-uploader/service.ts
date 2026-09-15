import { countAssetsByUploader as countAssetsByUploaderStore } from "./store";
import type { CountAssetsByUploaderQuery, CountAssetsByUploaderResult } from "./types";

export async function countAssetsByUploader(query: CountAssetsByUploaderQuery): Promise<CountAssetsByUploaderResult> {
  const count = await countAssetsByUploaderStore(query.uploaderId);
  return { success: true, data: count };
}
