import { describe, expect, it } from "vitest";
import { toSafeCallbackUrl } from "./safe-callback-url";

describe("toSafeCallbackUrl", () => {
  it("keeps same-origin relative paths", () => {
    expect(toSafeCallbackUrl("/academy/curso?aula=2")).toBe("/academy/curso?aula=2");
  });

  it("rejects open-redirect shapes and auth-flow loops", () => {
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", "/login", "/post-login", "", 42]) {
      expect(toSafeCallbackUrl(bad)).toBeNull();
    }
  });
});
