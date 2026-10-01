import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { bumpCacheVersion, readCacheVersion } from "./cache-version";

describe("cache version counter", () => {
  it("starts at 0 and increments atomically under concurrent bumps", async () => {
    const namespace = `test:${randomUUID()}`;
    expect(await readCacheVersion(namespace)).toBe(0);

    await Promise.all([1, 2, 3, 4, 5].map(() => bumpCacheVersion(namespace)));

    expect(await readCacheVersion(namespace)).toBe(5);
  });
});
