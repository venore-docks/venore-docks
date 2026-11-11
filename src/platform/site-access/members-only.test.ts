import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/settings", () => ({ getSetting: vi.fn() }));

import { isPathOpen, normalizeOpenPath, parseMembersOnlySetting } from "./members-only";

describe("parseMembersOnlySetting", () => {
  it("forma inesperada = desligado", () => {
    expect(parseMembersOnlySetting(null)).toEqual({ enabled: false, openPaths: [] });
    expect(parseMembersOnlySetting("x")).toEqual({ enabled: false, openPaths: [] });
    expect(parseMembersOnlySetting({ enabled: "true" }).enabled).toBe(false);
  });
  it("lê enabled e normaliza caminhos", () => {
    expect(parseMembersOnlySetting({ enabled: true, openPaths: ["calendarios/", "/a b", 3, "//x"] })).toEqual({
      enabled: true,
      openPaths: ["/calendarios"],
    });
  });
});

describe("normalizeOpenPath", () => {
  it("rejeita vazio e query", () => {
    expect(normalizeOpenPath("  ")).toBeNull();
    expect(normalizeOpenPath("/a?b=1")).toBeNull();
  });
});

describe("isPathOpen", () => {
  it("casa por segmento, não por prefixo de texto", () => {
    expect(isPathOpen("/calendarios", ["/calendarios"])).toBe(true);
    expect(isPathOpen("/calendarios/x", ["/calendarios"])).toBe(true);
    expect(isPathOpen("/calendarios-privado", ["/calendarios"])).toBe(false);
    expect(isPathOpen("/", [])).toBe(false);
  });
});
