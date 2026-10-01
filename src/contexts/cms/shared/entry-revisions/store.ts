import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { entryRevisions } from "../../database/schema";
import type { EntryProposalStatus, EntryRecord, EntryRevisionKind, EntryRevisionSummary, EntryVisibility } from "../../contracts/types";

export type RevisionState = {
  title: string;
  slug: string;
  categoryId: string | null;
  visibility: EntryVisibility;
  mediaId: string | null;
  contentTypeIds: string[] | null;
  data: unknown;
};

export type RevisionRow = RevisionState & {
  id: string;
  entryId: string;
  kind: EntryRevisionKind;
  status: EntryProposalStatus | null;
  createdBy: string | null;
  createdAt: Date;
};

export function stateOf(entry: EntryRecord): RevisionState {
  return {
    title: entry.title,
    slug: entry.slug,
    categoryId: entry.categoryId,
    visibility: entry.visibility,
    mediaId: entry.mediaId,
    contentTypeIds: entry.contentTypeIds,
    data: entry.data ?? {},
  };
}

export async function insertRevision(input: {
  entryId: string;
  kind: EntryRevisionKind;
  status: EntryProposalStatus | null;
  state: RevisionState;
  createdBy: string | null;
}): Promise<{ id: string }> {
  const [row] = await db
    .insert(entryRevisions)
    .values({
      entryId: input.entryId,
      kind: input.kind,
      status: input.status,
      // Campos explícitos: `state` pode ser uma RevisionRow inteira (restaurar snapshot) e o
      // spread levaria id/kind/createdAt da revisão de origem junto.
      title: input.state.title,
      slug: input.state.slug,
      categoryId: input.state.categoryId,
      visibility: input.state.visibility,
      mediaId: input.state.mediaId,
      contentTypeIds: input.state.contentTypeIds,
      data: input.state.data ?? {},
      createdBy: input.createdBy,
    })
    .returning({ id: entryRevisions.id });
  return row;
}

// Mantém só os `keep` snapshots mais recentes por entry (propostas nunca são podadas aqui).
export async function pruneSnapshots(entryId: string, keep: number): Promise<void> {
  const recent = await db
    .select({ id: entryRevisions.id })
    .from(entryRevisions)
    .where(and(eq(entryRevisions.entryId, entryId), eq(entryRevisions.kind, "snapshot")))
    .orderBy(desc(entryRevisions.createdAt))
    .limit(keep);
  if (recent.length < keep) return;
  await db.delete(entryRevisions).where(
    and(
      eq(entryRevisions.entryId, entryId),
      eq(entryRevisions.kind, "snapshot"),
      notInArray(
        entryRevisions.id,
        recent.map((row) => row.id),
      ),
    ),
  );
}

export async function listRevisionSummaries(entryId: string, limit = 50): Promise<EntryRevisionSummary[]> {
  const rows = await db
    .select({
      id: entryRevisions.id,
      entryId: entryRevisions.entryId,
      kind: entryRevisions.kind,
      status: entryRevisions.status,
      title: entryRevisions.title,
      slug: entryRevisions.slug,
      createdBy: entryRevisions.createdBy,
      createdAt: entryRevisions.createdAt,
      resolvedBy: entryRevisions.resolvedBy,
      resolvedAt: entryRevisions.resolvedAt,
    })
    .from(entryRevisions)
    .where(eq(entryRevisions.entryId, entryId))
    .orderBy(desc(entryRevisions.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    ...row,
    kind: row.kind as EntryRevisionKind,
    status: (row.status as EntryProposalStatus | null) ?? null,
  }));
}

export async function findRevision(id: string): Promise<RevisionRow | null> {
  const [row] = await db.select().from(entryRevisions).where(eq(entryRevisions.id, id)).limit(1);
  if (!row) return null;
  return {
    id: row.id,
    entryId: row.entryId,
    kind: row.kind as EntryRevisionKind,
    status: (row.status as EntryProposalStatus | null) ?? null,
    title: row.title,
    slug: row.slug,
    categoryId: row.categoryId,
    visibility: row.visibility as EntryVisibility,
    mediaId: row.mediaId,
    contentTypeIds: row.contentTypeIds ?? null,
    data: row.data,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

// Resolve uma proposta pendente (compare-and-swap no status: duas pessoas aplicando/descartando
// ao mesmo tempo — só uma vence).
export async function resolveProposal(id: string, status: "applied" | "discarded", actorId: string): Promise<boolean> {
  const rows = await db
    .update(entryRevisions)
    .set({ status, resolvedBy: actorId, resolvedAt: sql`now()` })
    .where(and(eq(entryRevisions.id, id), eq(entryRevisions.kind, "proposal"), eq(entryRevisions.status, "pending")))
    .returning({ id: entryRevisions.id });
  return rows.length > 0;
}

export async function countPendingProposals(entryIds: string[]): Promise<Map<string, number>> {
  if (entryIds.length === 0) return new Map();
  const rows = await db
    .select({ entryId: entryRevisions.entryId, count: sql<number>`count(*)::int` })
    .from(entryRevisions)
    .where(and(inArray(entryRevisions.entryId, entryIds), eq(entryRevisions.kind, "proposal"), eq(entryRevisions.status, "pending")))
    .groupBy(entryRevisions.entryId);
  return new Map(rows.map((row) => [row.entryId, row.count]));
}
