import { describe, expect, it } from "vitest";
import { resolveContextualBarSource } from "./resolve-contextual-bar-source";

describe("resolveContextualBarSource", () => {
  it("prefers plugin content over a configured contextual menu when both match the current path", () => {
    expect(resolveContextualBarSource(true, 3)).toBe("plugin");
  });

  it("falls back to the CMS contextual menu when there is no plugin content for the path", () => {
    expect(resolveContextualBarSource(false, 2)).toBe("menu");
  });

  it("resolves to none when neither plugin content nor a contextual menu match the path", () => {
    expect(resolveContextualBarSource(false, 0)).toBe("none");
  });

  it("resolves to plugin even when the contextual menu has zero items", () => {
    expect(resolveContextualBarSource(true, 0)).toBe("plugin");
  });
});
