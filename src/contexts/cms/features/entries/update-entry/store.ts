import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { entries } from "../../../database/schema";
import { replaceEntryContentTypes, toEntryRecord } from "../../../database/entry-content-types";
import type { EntryRecord, EntryVisibility } from "../../../contracts/types";

export async function findEntryById(id: string): Promise<EntryRecord | null> {
  const [row] = await db.select().from(entries).where(eq(entries.id, id)).limit(1);
  return row ? await toEntryRecord(row) : null;
}

// Mesma regra de unicidade pública de create-entry (categoryId, slug), excluindo a própria entry
// sendo editada — senão salvar sem mudar slug/categoria já dispararia falso-positivo de colisão.
// Só existência importa pro chamador (checagem de duplicata), por isso seleciona só o id em vez
// de montar um EntryRecord inteiro (que exigiria uma segunda consulta ao junction de tags à toa).
export async function findOtherEntryByCategoryAndSlug(
  id: string,
  categoryId: string | null,
  slug: string,
): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: entries.id })
    .from(entries)
    .where(
      and(
        categoryId ? eq(entries.categoryId, categoryId) : isNull(entries.categoryId),
        eq(entries.slug, slug),
        ne(entries.id, id),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function updateEntryFields(
  id: string,
  changes: {
    title?: string;
    slug?: string;
    categoryId?: string | null;
    contentTypeIds?: string[];
    visibility?: EntryVisibility;
    scheduledArchiveAt?: Date | null;
    pinnedAt?: Date | null;
    data?: unknown;
    mediaId?: string | null;
  },
): Promise<EntryRecord> {
  const { contentTypeIds, ...fields } = changes;

  // toEntryRecord roda DEPOIS do commit (fora da transação), lendo pelo `db` normal — chamá-lo
  // com `tx` por dentro veria o junction ainda não commitado só por sorte de mesma conexão; com
  // `db` (pool separado) arriscaria ler estado pré-commit da escrita que acabou de acontecer.
  const row = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(entries)
      .set({ ...fields, updatedAt: sql`now()` })
      .where(eq(entries.id, id))
      .returning();

    if (contentTypeIds !== undefined) {
      await replaceEntryContentTypes(tx, id, contentTypeIds);
    }

    return updated;
  });

  return toEntryRecord(row);
}
