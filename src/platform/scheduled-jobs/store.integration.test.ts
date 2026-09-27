import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { claimJob, finishJob } from "./store";

describe("scheduled job store", () => {
  it("lets exactly one concurrent caller claim a due job", async () => {
    const key = `test.${randomUUID()}`;
    const claims = await Promise.all([1, 2, 3].map(() => claimJob(key, 60_000, 60_000)));
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it("does not re-run inside the interval, even after finishing", async () => {
    const key = `test.${randomUUID()}`;
    expect(await claimJob(key, 60_000, 60_000)).toBe(true);
    await finishJob(key, "success", null);
    expect(await claimJob(key, 60_000, 60_000)).toBe(false);
  });

  it("runs again once the interval elapsed", async () => {
    const key = `test.${randomUUID()}`;
    expect(await claimJob(key, 1, 60_000)).toBe(true);
    await finishJob(key, "success", null);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await claimJob(key, 1, 60_000)).toBe(true);
  });
});
