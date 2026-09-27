import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/infrastructure/database/client";
import { users } from "../../../database/schema";
import { findUserByEmail } from "./store";

describe("findUserByEmail (store)", () => {
  it("matches regardless of case and the database refuses a second account differing only by case", async () => {
    const local = randomUUID();
    await db.insert(users).values({ email: `${local}@Example.COM`, status: "approved" });

    const found = await findUserByEmail(`${local}@example.com`);
    expect(found?.email).toBe(`${local}@Example.COM`);

    await expect(db.insert(users).values({ email: `${local}@example.com`, status: "approved" })).rejects.toThrow();
  });
});
