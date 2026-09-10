import { findAllSources } from "./store";
import type { ListSourcesResult } from "./types";

export async function listSources(): Promise<ListSourcesResult> {
  const sources = await findAllSources();
  return { success: true, data: sources };
}
