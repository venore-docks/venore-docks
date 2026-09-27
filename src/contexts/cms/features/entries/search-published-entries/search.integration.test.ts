import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/infrastructure/database/client";
import { users } from "@/contexts/auth/database/schema";
import { entries } from "../../../database/schema";
import { searchPublishedEntriesHandler } from "./handler";

async function seedEntry(authorId: string, fields: { title: string; text: string; status?: string; visibility?: string }) {
  const composition = [
    {
      id: "b1",
      key: "core.content.richtext",
      slot: "main",
      htmlId: null,
      areas: [],
      data: { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: fields.text }] }] } },
    },
  ];
  await db.insert(entries).values({
    title: fields.title,
    slug: `s-${randomUUID()}`,
    status: fields.status ?? "published",
    visibility: fields.visibility ?? "public",
    data: { blocks: composition },
    authorId,
    publishedAt: new Date(),
  });
}

describe("searchPublishedEntries (Postgres FTS)", () => {
  it("finds by title and body, with or without accents, only published and public", async () => {
    const [author] = await db.insert(users).values({ email: `${randomUUID()}@integration.test`, status: "approved" }).returning({ id: users.id });
    const tag = randomUUID().slice(0, 8);
    await seedEntry(author.id, { title: `Inscrições abertas ${tag}`, text: "Informações sobre o processo seletivo" });
    await seedEntry(author.id, { title: `Rascunho ${tag}`, text: "Informações internas", status: "draft" });
    await seedEntry(author.id, { title: `Só para membros ${tag}`, text: "Informações restritas", visibility: "authenticated" });

    const byTitle = await searchPublishedEntriesHandler({ query: "inscrições", includeAuthenticated: false, limit: 10, offset: 0 });
    const unaccented = await searchPublishedEntriesHandler({ query: "inscricoes", includeAuthenticated: false, limit: 10, offset: 0 });
    const body = await searchPublishedEntriesHandler({ query: `informações ${tag}`, includeAuthenticated: false, limit: 10, offset: 0 });
    const member = await searchPublishedEntriesHandler({ query: `informações ${tag}`, includeAuthenticated: true, limit: 10, offset: 0 });

    const titles = (result: typeof byTitle) => (result.success ? result.data.entries.map((entry) => entry.title) : []);
    expect(titles(byTitle)).toContain(`Inscrições abertas ${tag}`);
    expect(titles(unaccented)).toContain(`Inscrições abertas ${tag}`);
    expect(titles(body)).toEqual([`Inscrições abertas ${tag}`]);
    expect(titles(member).sort()).toEqual([`Inscrições abertas ${tag}`, `Só para membros ${tag}`].sort());
  });
});
