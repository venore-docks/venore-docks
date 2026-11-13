import { resolveMediaActorScope } from "../../../resolve-media-actor-scope";
import { getMediaLibraryStats } from "./service";
import type { GetMediaLibraryStatsResult } from "./types";

const EMPTY_STATS = {
  total: 0,
  uncategorized: 0,
  byCategory: {},
  byKind: { image: 0, video: 0, audio: 0, document: 0 },
  byVisibility: { public: 0, restricted: 0, private: 0 },
  totalSize: 0,
};

export async function getMediaLibraryStatsHandler(): Promise<GetMediaLibraryStatsResult> {
  const scope = await resolveMediaActorScope();
  if (!scope) return { success: true, data: EMPTY_STATS };
  return getMediaLibraryStats(scope);
}
