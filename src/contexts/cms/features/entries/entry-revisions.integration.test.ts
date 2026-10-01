import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/infrastructure/database/client";
import { categories } from "@/contexts/cms/database/schema";
import { createEntry } from "@/contexts/cms/features/entries/create-entry/service";
import { updateEntry } from "@/contexts/cms/features/entries/update-entry/service";
import { publishEntry } from "@/contexts/cms/features/entries/publish-entry/service";
import { archiveEntry } from "@/contexts/cms/features/entries/archive-entry/service";
import { getEntry } from "@/contexts/cms/features/entries/get-entry/service";
import { applyEntryRevision } from "@/contexts/cms/features/entries/apply-entry-revision/service";
import { discardEntryProposal } from "@/contexts/cms/features/entries/discard-entry-proposal/service";
import { listEntryRevisions } from "@/contexts/cms/features/entries/list-entry-revisions/service";
import { seedUserWithSystemRole } from "@/test-support/integration/rbac-seed";
import type { OperationResult } from "@/shared/types";

function unwrap<T>(result: OperationResult<T>): T {
  if (!result.success) throw new Error(`${result.error.code} — ${result.error.message}`);
  return result.data;
}

async function seedCategory(): Promise<{ id: string }> {
  const [row] = await db
    .insert(categories)
    .values({ key: `k-${randomUUID()}`, slug: `s-${randomUUID()}`, name: "Blog" })
    .returning({ id: categories.id });
  return row;
}

const resolveDefinition = () => null;

async function publishedEntryIn(categoryId: string, editorId: string, title: string) {
  const entry = unwrap(await createEntry({ contentTypeIds: [], categoryId, title, slug: `e-${randomUUID()}`, actorId: editorId }));
  unwrap(await publishEntry({ id: entry.id, actorId: editorId, resolveDefinition }));
  return entry;
}

describe("CMS — revisões e propostas (conteúdo publicado)", () => {
  it("author edita conteúdo PUBLICADO: vira proposta, o site não muda, editor aplica", async () => {
    const cat = await seedCategory();
    const editor = await seedUserWithSystemRole("editor", { categoryIds: [cat.id] });
    const author = await seedUserWithSystemRole("author", { categoryIds: [cat.id] });
    const entry = await publishedEntryIn(cat.id, editor.userId, "Título no ar");

    const proposed = unwrap(await updateEntry({ id: entry.id, title: "Título do autor", actorId: author.userId }));
    expect(proposed.proposalId).not.toBeNull();
    expect(unwrap(await getEntry({ id: entry.id }))?.title).toBe("Título no ar");

    // O autor não aplica a própria proposta.
    const denied = await applyEntryRevision({ revisionId: proposed.proposalId!, actorId: author.userId });
    expect(denied.success).toBe(false);

    const applied = unwrap(await applyEntryRevision({ revisionId: proposed.proposalId!, actorId: editor.userId }));
    expect(applied.applied).toBe(true);
    expect(unwrap(await getEntry({ id: entry.id }))?.title).toBe("Título do autor");

    // Aplicar de novo não vale (proposta já resolvida).
    expect((await applyEntryRevision({ revisionId: proposed.proposalId!, actorId: editor.userId })).success).toBe(false);
  });

  it("editor edita direto e o estado anterior fica no histórico, restaurável", async () => {
    const cat = await seedCategory();
    const editor = await seedUserWithSystemRole("editor", { categoryIds: [cat.id] });
    const entry = await publishedEntryIn(cat.id, editor.userId, "Versão 1");

    const updated = unwrap(await updateEntry({ id: entry.id, title: "Versão 2", actorId: editor.userId }));
    expect(updated.proposalId).toBeNull();

    const history = unwrap(await listEntryRevisions({ entryId: entry.id, actorId: editor.userId }));
    const snapshot = history.revisions.find((revision) => revision.kind === "snapshot" && revision.title === "Versão 1");
    expect(snapshot).toBeDefined();

    unwrap(await applyEntryRevision({ revisionId: snapshot!.id, actorId: editor.userId }));
    expect(unwrap(await getEntry({ id: entry.id }))?.title).toBe("Versão 1");
  });

  it("author não arquiva conteúdo publicado e pode descartar a própria proposta", async () => {
    const cat = await seedCategory();
    const editor = await seedUserWithSystemRole("editor", { categoryIds: [cat.id] });
    const author = await seedUserWithSystemRole("author", { categoryIds: [cat.id] });
    const entry = await publishedEntryIn(cat.id, editor.userId, "No ar");

    const archive = await archiveEntry({ id: entry.id, actorId: author.userId });
    expect(archive.success).toBe(false);
    if (!archive.success) expect(archive.error.code).toBe("cms.entries.publish_required");

    const proposed = unwrap(await updateEntry({ id: entry.id, title: "Talvez", actorId: author.userId }));
    expect((await discardEntryProposal({ revisionId: proposed.proposalId!, actorId: author.userId })).success).toBe(true);
  });
});
