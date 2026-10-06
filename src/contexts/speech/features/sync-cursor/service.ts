import { getCursor, setCursor } from "../../shared/store";

// Cursor de reconciliação (ver database/schema: syncCursors).
export async function getSpeechSyncCursor(key: string): Promise<Date | null> {
  return getCursor(key);
}

export async function setSpeechSyncCursor(key: string, cursor: Date): Promise<void> {
  await setCursor(key, cursor);
}
