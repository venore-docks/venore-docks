import type { OperationResult } from "@/shared/types";
import type { ContentFeedArticleRecord } from "../../contracts/types";

export type ListArticlesQuery = { categoryKeys?: string[] };
export type ContentFeedArticleView = ContentFeedArticleRecord & { sourceName: string; readMoreUrl: string | null };
export type ListArticlesResult = OperationResult<ContentFeedArticleView[]>;
