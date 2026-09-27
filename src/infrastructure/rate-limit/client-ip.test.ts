import { describe, expect, it } from "vitest";
import { getClientIp } from "./client-ip";

describe("getClientIp", () => {
  it("prefers the Vercel header, then x-real-ip", () => {
    expect(getClientIp(new Headers({ "x-vercel-forwarded-for": "1.1.1.1", "x-real-ip": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(getClientIp(new Headers({ "x-real-ip": "2.2.2.2", "x-forwarded-for": "9.9.9.9" }))).toBe("2.2.2.2");
  });

  it("uses the LAST x-forwarded-for hop, which the client cannot forge", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 3.3.3.3" }))).toBe("3.3.3.3");
  });

  it("falls back to a shared bucket", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});
