import { desc, inArray } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import type { OperationResult } from "@/shared/types";
import { THEME_CONFIG_HISTORY_LIMIT } from "../../../contracts/v8/config-document";
import { themeConfigRevisions } from "../../../database/schema";
import { guardThemeConfigStorage } from "../shared/guard-storage";
import type { ThemeConfigRevisionRow } from "../shared/revision-view";

export async function listPublishedRevisionRows(): Promise<OperationResult<ThemeConfigRevisionRow[]>> {
  return guardThemeConfigStorage(() =>
    db
      .select()
      .from(themeConfigRevisions)
      .where(inArray(themeConfigRevisions.status, ["published", "archived"]))
      .orderBy(desc(themeConfigRevisions.publishedAt), desc(themeConfigRevisions.createdAt))
      .limit(THEME_CONFIG_HISTORY_LIMIT),
  );
}
