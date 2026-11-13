import { describe, expect, it } from "vitest";
import { db } from "@/infrastructure/database/client";
import { entries } from "../../../database/schema";
import { seedUser } from "@/test-support/integration/user-seed";
import { findPublishedEntries } from "./store";

// "Fixar no topo": com `limit` (feeds e listagem de categoria), as fixadas vêm primeiro — a fixada
// por último na frente — e o resto segue por publishedAt desc.
describe("cms — ordem de entries fixadas (integração)", () => {
  it("fixadas antes das mais recentes; entre fixadas, a fixada por último primeiro", async () => {
    const author = await seedUser();
    const base = { authorId: author.id, status: "published", visibility: "public", data: {} };
    await db.insert(entries).values([
      { ...base, id: "nova", title: "Nova", slug: "nova", publishedAt: new Date("2026-11-10T12:00:00Z") },
      { ...base, id: "media", title: "Média", slug: "media", publishedAt: new Date("2026-11-05T12:00:00Z") },
      {
        ...base,
        id: "antiga-fixada",
        title: "Antiga fixada",
        slug: "antiga-fixada",
        publishedAt: new Date("2026-01-01T12:00:00Z"),
        pinnedAt: new Date("2026-11-01T12:00:00Z"),
      },
      {
        ...base,
        id: "fixada-depois",
        title: "Fixada depois",
        slug: "fixada-depois",
        publishedAt: new Date("2026-02-01T12:00:00Z"),
        pinnedAt: new Date("2026-11-11T12:00:00Z"),
      },
    ]);

    const rows = await findPublishedEntries({ limit: 10 });
    expect(rows.map((row) => row.id)).toEqual(["fixada-depois", "antiga-fixada", "nova", "media"]);
    expect(rows[0].pinnedAt).toBeInstanceOf(Date);
    expect(rows[2].pinnedAt).toBeNull();
  });
});
