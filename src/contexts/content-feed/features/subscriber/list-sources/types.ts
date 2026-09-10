import type { OperationResult } from "@/shared/types";
import type { ContentFeedSourceRecord } from "../../../contracts/types";

export type SourceView = ContentFeedSourceRecord & { articleCount: number };
export type ListSourcesResult = OperationResult<SourceView[]>;
