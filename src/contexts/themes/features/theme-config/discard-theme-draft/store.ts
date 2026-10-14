import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import type { OperationResult } from "@/shared/types";
import { themeConfigRevisions } from "../../../database/schema";
import { guardThemeConfigStorage } from "../shared/guard-storage";

export async function deleteDraftRevision(): Promise<OperationResult<string | null>> {
  return guardThemeConfigStorage(async () => {
    const rows = await db
      .delete(themeConfigRevisions)
      .where(eq(themeConfigRevisions.status, "draft"))
      .returning({ id: themeConfigRevisions.id });
    return rows[0]?.id ?? null;
  });
}
