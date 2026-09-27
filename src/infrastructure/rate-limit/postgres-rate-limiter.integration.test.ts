import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkRateLimit, deleteExpiredRateLimits } from "./postgres-rate-limiter";

describe("postgres rate limiter", () => {
  it("counts hits atomically across calls and blocks past the limit", async () => {
    const key = `test:${randomUUID()}`;
    const config = { limit: 3, windowMs: 60_000 };

    const results = await Promise.all([1, 2, 3, 4].map(() => checkRateLimit(key, config)));
    expect(results.filter((result) => result.allowed)).toHaveLength(3);
    expect(results.filter((result) => !result.allowed)).toHaveLength(1);
  });

  it("opens a new window once the previous one expired", async () => {
    const key = `test:${randomUUID()}`;
    const config = { limit: 1, windowMs: 1 };

    expect((await checkRateLimit(key, config)).allowed).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect((await checkRateLimit(key, config)).allowed).toBe(true);
  });

  it("sweeps expired windows", async () => {
    const key = `test:${randomUUID()}`;
    await checkRateLimit(key, { limit: 5, windowMs: 1 });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await deleteExpiredRateLimits()).toBeGreaterThanOrEqual(1);
  });
});
