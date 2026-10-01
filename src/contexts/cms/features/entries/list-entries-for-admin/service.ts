import { findAllEntries } from "./store";
import type { ListEntriesForAdminQuery, ListEntriesForAdminResult } from "./types";

export async function listEntriesForAdmin(query: ListEntriesForAdminQuery): Promise<ListEntriesForAdminResult> {
  const entries = await findAllEntries({
    contentTypeId: query.contentTypeId,
    categoryId: query.categoryId,
    status: query.status,
    allowedCategoryIds: query.allowedCategoryIds,
    limit: query.limit,
    offset: query.offset,
    search: query.search,
  });
  return { success: true, data: entries };
}
