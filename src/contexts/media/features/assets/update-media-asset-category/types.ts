import type { OperationResult } from "@/shared/types";
import type { MediaAsset } from "../../../contracts/types";

export type UpdateMediaAssetCategoryCommand = { id: string; categoryId: string | null; actorId: string; isMediaAdmin: boolean; isSuperadmin?: boolean };
export type UpdateMediaAssetCategoryInput = { id: string; categoryId: string | null };
export type UpdateMediaAssetCategoryResult = OperationResult<MediaAsset>;
