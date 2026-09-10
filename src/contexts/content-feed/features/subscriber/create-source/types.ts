import type { OperationResult } from "@/shared/types";
import type { ContentFeedSourceRecord } from "../../../contracts/types";

export type CreateSourceInput = { name: string; remoteUrl: string; connectionKey: string; categoryKeys: string[] };
export type CreateSourceCommand = CreateSourceInput & { actorId: string };
export type CreateSourceResult = OperationResult<ContentFeedSourceRecord>;
