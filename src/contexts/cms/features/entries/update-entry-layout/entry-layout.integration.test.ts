import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/infrastructure/database/client";
import { categories } from "@/contexts/cms/database/schema";
import { createEntry } from "@/contexts/cms/features/entries/create-entry/service";
import { updateEntry } from "@/contexts/cms/features/entries/update-entry/service";
import { updateEntryComposition } from "@/contexts/cms/features/entries/update-entry-composition/service";
import { publishEntry } from "@/contexts/cms/features/entries/publish-entry/service";
import { getEntry } from "@/contexts/cms/features/entries/get-entry/service";
import { listEntryRevisions } from "@/contexts/cms/features/entries/list-entry-revisions/service";
import { updateEntryLayout } from "@/contexts/cms/features/entries/update-entry-layout/service";
import { seedUserWithSystemRole } from "@/test-support/integration/rbac-seed";
import type { OperationResult } from "@/shared/types";

// Layout por página (spec v8 §4.5): data.layout sobrevive aos DOIS merges rasos de data
// (update-entry com data.body, update-entry-composition com data.blocks), entra no snapshot de
// revisão e segue o fluxo de proposta com a entry no ar.

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

async function dataOf(id: string): Promise<Record<string, unknown>> {
  return (unwrap(await getEntry({ id }))?.data ?? {}) as Record<string, unknown>;
}

describe("CMS — layout por página (data.layout)", () => {
  it("sobrevive a update-entry (data.body) e a update-entry-composition (data.blocks)", async () => {
    const cat = await seedCategory();
    const editor = await seedUserWithSystemRole("editor", { categoryIds: [cat.id] });
    const entry = unwrap(await createEntry({ contentTypeIds: [], categoryId: cat.id, title: "Página", slug: `p-${randomUUID()}`, actorId: editor.userId }));

    unwrap(await updateEntryLayout({ entryId: entry.id, layout: { width: "full", rail: "hidden" }, actorId: editor.userId }));
    unwrap(await updateEntry({ id: entry.id, data: { body: "texto" }, actorId: editor.userId }));
    unwrap(await updateEntryComposition({ id: entry.id, composition: [], resolveDefinition, actorId: editor.userId }));

    const data = await dataOf(entry.id);
    expect(data.layout).toEqual({ width: "full", rail: "hidden" });
    expect(data.body).toBe("texto");
    expect(data.blocks).toEqual([]);
  });

  it("author num conteúdo publicado vira proposta; fora do escopo é recusado; editor grava com snapshot", async () => {
    const cat = await seedCategory();
    const editor = await seedUserWithSystemRole("editor", { categoryIds: [cat.id] });
    const author = await seedUserWithSystemRole("author", { categoryIds: [cat.id] });
    const entry = unwrap(await createEntry({ contentTypeIds: [], categoryId: cat.id, title: "No ar", slug: `p-${randomUUID()}`, actorId: editor.userId }));
    unwrap(await publishEntry({ id: entry.id, actorId: editor.userId, resolveDefinition }));

    const proposed = unwrap(await updateEntryLayout({ entryId: entry.id, layout: { contextualBar: "top" }, actorId: author.userId }));
    expect(proposed.proposed).toBe(true);
    expect((await dataOf(entry.id)).layout).toBeUndefined();

    const other = await seedCategory();
    const outsider = await seedUserWithSystemRole("editor", { categoryIds: [other.id] });
    expect((await updateEntryLayout({ entryId: entry.id, layout: { width: "wide" }, actorId: outsider.userId })).success).toBe(false);

    unwrap(await updateEntryLayout({ entryId: entry.id, layout: { width: "wide" }, actorId: editor.userId }));
    expect((await dataOf(entry.id)).layout).toEqual({ width: "wide" });

    const history = unwrap(await listEntryRevisions({ entryId: entry.id, actorId: editor.userId }));
    expect(history.revisions.some((revision) => revision.kind === "proposal")).toBe(true);
    expect(history.revisions.some((revision) => revision.kind === "snapshot")).toBe(true);
  });
});
