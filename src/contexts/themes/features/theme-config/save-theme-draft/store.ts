import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import type { OperationResult } from "@/shared/types";
import type { ThemeConfigDocument } from "../../../contracts/v8/config-document";
import { themeConfigRevisions } from "../../../database/schema";
import { guardThemeConfigStorage } from "../shared/guard-storage";
import type { ThemeConfigRevisionRow } from "../shared/revision-view";

export type UpsertDraftValues = {
  config: ThemeConfigDocument;
  // undefined = mantém o do rascunho existente (ou, num rascunho novo, a revisão publicada atual).
  basedOnRevisionId: string | null | undefined;
  note: string | null | undefined;
  actorId: string;
};

// Um rascunho por site (índice único parcial): atualiza o existente ou cria. `created_by`/
// `created_at` registram o último salvamento (a tabela não tem updated_at). Tudo numa transação,
// pra que dois salvamentos simultâneos não criem dois rascunhos (o segundo insert falharia no
// índice único).
export async function upsertDraftRevision(values: UpsertDraftValues): Promise<OperationResult<ThemeConfigRevisionRow>> {
  return guardThemeConfigStorage(() =>
    db.transaction(async (tx) => {
      const [existing] = await tx.select().from(themeConfigRevisions).where(eq(themeConfigRevisions.status, "draft")).limit(1);
      const now = new Date();
      if (existing) {
        const [updated] = await tx
          .update(themeConfigRevisions)
          .set({
            config: values.config,
            basedOnRevisionId: values.basedOnRevisionId === undefined ? existing.basedOnRevisionId : values.basedOnRevisionId,
            note: values.note === undefined ? existing.note : values.note,
            createdBy: values.actorId,
            createdAt: now,
          })
          .where(eq(themeConfigRevisions.id, existing.id))
          .returning();
        return updated;
      }

      let basedOnRevisionId = values.basedOnRevisionId ?? null;
      if (values.basedOnRevisionId === undefined) {
        const [published] = await tx
          .select({ id: themeConfigRevisions.id })
          .from(themeConfigRevisions)
          .where(eq(themeConfigRevisions.status, "published"))
          .limit(1);
        basedOnRevisionId = published?.id ?? null;
      }
      const [inserted] = await tx
        .insert(themeConfigRevisions)
        .values({
          status: "draft",
          config: values.config,
          basedOnRevisionId,
          note: values.note ?? null,
          createdBy: values.actorId,
          createdAt: now,
        })
        .returning();
      return inserted;
    }),
  );
}
