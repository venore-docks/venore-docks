import { countEntriesByAuthor as countEntriesByAuthorStore } from "./store";
import type { CountEntriesByAuthorQuery, CountEntriesByAuthorResult } from "./types";

export async function countEntriesByAuthor(query: CountEntriesByAuthorQuery): Promise<CountEntriesByAuthorResult> {
  const count = await countEntriesByAuthorStore(query.authorId);
  return { success: true, data: count };
}
