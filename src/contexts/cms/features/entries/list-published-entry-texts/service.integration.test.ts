import { describe, expect, it } from "vitest";
import { db } from "@/infrastructure/database/client";
import { entries } from "../../../database/schema";
import { seedUser } from "@/test-support/integration/user-seed";
import { filterEntryIdsKeepingSpeech, listPublishedEntryTexts } from "./service";

// Leitura de sistema da leitura em voz alta: só entry publicada, pública e editorial; o cursor
// (Date do JS, milissegundos) não pode reler para sempre a última entry (microssegundos no banco).
describe("cms — textos de entries publicadas (integração)", () => {
  it("filtra por publicação/visibilidade e respeita o cursor em milissegundos", async () => {
    const author = await seedUser();
    const base = { authorId: author.id, data: { body: "Corpo." } };
    await db.insert(entries).values([
      { ...base, id: "p1", title: "Pública", slug: "p1", status: "published", visibility: "public" },
      { ...base, id: "p2", title: "Só logado", slug: "p2", status: "published", visibility: "authenticated" },
      { ...base, id: "p3", title: "Rascunho", slug: "p3", status: "draft", visibility: "public" },
      { ...base, id: "p4", title: "Interna", slug: "p4", status: "published", visibility: "public", internalOwner: "academy" },
    ]);

    const first = await listPublishedEntryTexts({ updatedAfter: null, limit: 10 });
    expect(first.map((entry) => entry.id)).toEqual(["p1"]);
    expect(first[0].text).toBe("Pública\n\nCorpo.");

    const again = await listPublishedEntryTexts({ updatedAfter: first[0].updatedAt, limit: 10 });
    expect(again).toEqual([]);

    expect((await filterEntryIdsKeepingSpeech(["p1", "p2", "p3", "p4", "sumiu"])).sort()).toEqual(["p1", "p3"]);
  });
});
