import { describe, expect, it } from "vitest";
import { isPathUnderPrefix, normalizePathPrefix } from "./normalize-path-prefix";

describe("normalizePathPrefix", () => {
  it.each([
    ["/rh/", "/rh"],
    ["rh", "/rh"],
    ["/RH", "/rh"],
    ["//rh//x/", "/rh/x"],
    ["/not%C3%ADcias", "/notícias"],
    ["/", "/"],
    ["", "/"],
    ["/%E0%A4%A", "/%e0%a4%a"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePathPrefix(input)).toBe(expected);
  });

  it("NFC: forma decomposta vira composta", () => {
    expect(normalizePathPrefix("/notícias")).toBe("/notícias");
  });
});

describe("isPathUnderPrefix", () => {
  it("casa em fronteira de segmento", () => {
    expect(isPathUnderPrefix("/rh", "/rh/")).toBe(true);
    expect(isPathUnderPrefix("/RH/ferias", "rh")).toBe(true);
    expect(isPathUnderPrefix("/rhx", "/rh")).toBe(false);
    expect(isPathUnderPrefix("/qualquer", "/")).toBe(true);
  });
});
