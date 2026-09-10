import type { OperationResult } from "@/shared/types";
import type { ContentFeedApiArticle } from "../../../contracts/types";

export type ListArticlesForConnectionQuery = { key: string; updatedSince?: Date };
export type ListArticlesForConnectionResult = OperationResult<{ articles: ContentFeedApiArticle[] }>;
