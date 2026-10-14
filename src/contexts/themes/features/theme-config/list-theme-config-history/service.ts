import type { ThemeConfigRevisionView } from "../../../contracts/v8/config-document";
import { toThemeConfigRevisionView } from "../shared/revision-view";
import { listPublishedRevisionRows } from "./store";
import type { ListThemeConfigHistoryResult } from "./types";

export async function listThemeConfigHistory(): Promise<ListThemeConfigHistoryResult> {
  const rows = await listPublishedRevisionRows();
  if (!rows.success) return rows;
  const items = rows.data.map(toThemeConfigRevisionView).filter((view): view is ThemeConfigRevisionView => view !== null);
  return { success: true, data: { items } };
}
