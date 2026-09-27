import { describe, expect, it } from "vitest";
import { serializeJsonLd, toJsonLdSafeText } from "./json-ld";

describe("serializeJsonLd", () => {
  it("never emits a raw < or > that could close the <script> tag", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toMatch(/[<>]/);
    expect(JSON.parse(out)).toEqual({ name: "</script><script>alert(1)</script>" });
  });

  it("escapes & and the JS line separators", () => {
    const out = serializeJsonLd({ name: "a & b\u2028c" });
    expect(out).toContain("\\u0026");
    expect(out).toContain("\\u2028");
    expect(JSON.parse(out)).toEqual({ name: "a & b\u2028c" });
  });
});

describe("toJsonLdSafeText", () => {
  it("replaces angle brackets so plain JSON.stringify output is inert", () => {
    const safe = toJsonLdSafeText("</script><b>");
    expect(JSON.stringify({ safe })).not.toMatch(/[<>]/);
  });
});
