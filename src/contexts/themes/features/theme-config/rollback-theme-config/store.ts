import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import type { OperationResult } from "@/shared/types";
import { themeConfigRevisions } from "../../../database/schema";
import { guardThemeConfigStorage } from "../shared/guard-storage";
import type { ThemeConfigRevisionRow } from "../shared/revision-view";

export async function findRevisionRow(id: string): Promise<OperationResult<ThemeConfigRevisionRow | null>> {
  return guardThemeConfigStorage(async () => {
    const rows = await db.select().from(themeConfigRevisions).where(eq(themeConfigRevisions.id, id)).limit(1);
    return rows[0] ?? null;
  });
}
