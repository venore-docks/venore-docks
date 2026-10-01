import { findEntriesAuthoredBy } from "./store";
import type { ListOwnAuthoredEntriesResult } from "./types";

export async function listOwnAuthoredEntries(userId: string): Promise<ListOwnAuthoredEntriesResult> {
  return { success: true, data: await findEntriesAuthoredBy(userId) };
}
