import type { OperationResult } from "@/shared/types";
import type { ContentFeedSourceRecord } from "../../../contracts/types";

export type UpdateSourceInput = {
  id: string;
  name?: string;
  remoteUrl?: string;
  connectionKey?: string;
  categoryKeys?: string[];
};
export type UpdateSourceCommand = UpdateSourceInput & { actorId: string };
export type UpdateSourceResult = OperationResult<ContentFeedSourceRecord>;
