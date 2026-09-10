import type { OperationResult } from "@/shared/types";
import type { ContentFeedConnectionRecord } from "../../../contracts/types";

export type UpdateConnectionCategoriesInput = { id: string; categoryIds: string[] };
export type UpdateConnectionCategoriesCommand = UpdateConnectionCategoriesInput & { actorId: string };
export type UpdateConnectionCategoriesResult = OperationResult<ContentFeedConnectionRecord>;
