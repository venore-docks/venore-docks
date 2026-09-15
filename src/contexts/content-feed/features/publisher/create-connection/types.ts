import type { OperationResult } from "@/shared/types";
import type { ContentFeedConnectionRecord } from "../../../contracts/types";

export type CreateConnectionInput = { name: string; categoryIds: string[] };
export type CreateConnectionCommand = CreateConnectionInput & { actorId: string };
export type CreateConnectionResult = OperationResult<ContentFeedConnectionRecord>;
