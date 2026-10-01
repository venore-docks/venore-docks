import type { OperationResult } from "@/shared/types";
import type { MediaAsset, MediaVisibility } from "../../../contracts/types";

export type UpdateMediaAssetVisibilityCommand = { id: string; visibility: MediaVisibility; actorId: string; isMediaAdmin: boolean; isSuperadmin?: boolean };
export type UpdateMediaAssetVisibilityInput = { id: string; visibility: MediaVisibility };
export type UpdateMediaAssetVisibilityResult = OperationResult<MediaAsset>;
