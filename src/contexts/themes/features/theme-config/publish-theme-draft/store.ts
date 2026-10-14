import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import type { OperationResult } from "@/shared/types";
import { THEME_CONFIG_HISTORY_LIMIT } from "../../../contracts/v8/config-document";
import { themeConfigRevisions } from "../../../database/schema";
import { guardThemeConfigStorage } from "../shared/guard-storage";
import type { ThemeConfigRevisionRow } from "../shared/revision-view";

export type PublishTransactionResult = {
  revision: ThemeConfigRevisionRow;
  previousPublishedId: string | null;
  prunedIds: string[];
};

// Arquivados em ordem de publicação (mais novo primeiro): o que passa do limite sai.
export function selectRevisionsToPrune(archivedNewestFirst: readonly { id: string }[], limit = THEME_CONFIG_HISTORY_LIMIT): string[] {
  return archivedNewestFirst.slice(limit).map((row) => row.id);
}

// Passo 2 da publicação (spec §4.3), UMA transação: arquiva o publicado atual, promove o rascunho
// e poda os arquivados além de THEME_CONFIG_HISTORY_LIMIT. A ordem (arquivar antes de promover)
// respeita o índice único parcial de "published". null = não há rascunho.
export async function publishDraftTransaction(input: { actorId: string; now: Date }): Promise<OperationResult<PublishTransactionResult | null>> {
  return guardThemeConfigStorage(() =>
    db.transaction(async (tx) => {
      const [draft] = await tx.select().from(themeConfigRevisions).where(eq(themeConfigRevisions.status, "draft")).limit(1);
      if (!draft) return null;

      const [previous] = await tx
        .select({ id: themeConfigRevisions.id })
        .from(themeConfigRevisions)
        .where(eq(themeConfigRevisions.status, "published"))
        .limit(1);
      if (previous) {
        await tx.update(themeConfigRevisions).set({ status: "archived" }).where(eq(themeConfigRevisions.id, previous.id));
      }

      const [revision] = await tx
        .update(themeConfigRevisions)
        .set({ status: "published", publishedBy: input.actorId, publishedAt: input.now })
        .where(eq(themeConfigRevisions.id, draft.id))
        .returning();

      const archived = await tx
        .select({ id: themeConfigRevisions.id })
        .from(themeConfigRevisions)
        .where(eq(themeConfigRevisions.status, "archived"))
        .orderBy(desc(themeConfigRevisions.publishedAt), desc(themeConfigRevisions.createdAt));
      const prunedIds = selectRevisionsToPrune(archived);
      if (prunedIds.length > 0) {
        await tx
          .delete(themeConfigRevisions)
          .where(and(eq(themeConfigRevisions.status, "archived"), inArray(themeConfigRevisions.id, prunedIds)));
      }

      return { revision, previousPublishedId: previous?.id ?? null, prunedIds };
    }),
  );
}

// Desfaz o passo 2 quando a gravação no settings falha (passo 3): a revisão volta a ser rascunho
// e a anterior volta a ser a publicada — o settings nunca fica mais novo que o histórico. (Um
// arquivado podado nessa mesma publicação não volta: é o 21º mais antigo.)
export async function revertPublishTransaction(input: { revisionId: string; previousPublishedId: string | null }): Promise<OperationResult<void>> {
  return guardThemeConfigStorage(() =>
    db.transaction(async (tx) => {
      await tx
        .update(themeConfigRevisions)
        .set({ status: "draft", publishedBy: null, publishedAt: null })
        .where(eq(themeConfigRevisions.id, input.revisionId));
      if (input.previousPublishedId) {
        await tx.update(themeConfigRevisions).set({ status: "published" }).where(eq(themeConfigRevisions.id, input.previousPublishedId));
      }
    }),
  );
}
