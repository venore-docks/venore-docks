import type { OperationResult } from "@/shared/types";

export type OwnMediaAssetSummary = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  visibility: string;
  createdAt: Date;
  deletedAt: Date | null;
};
export type ListOwnMediaAssetsResult = OperationResult<OwnMediaAssetSummary[]>;
