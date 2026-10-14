import { describe, expect, it } from "vitest";
import { canonicalLocale, directionForLocale, parseDocumentLocale } from "./locale";

describe("locale do site", () => {
  it("canoniza BCP-47 e recusa inválido", () => {
    expect(canonicalLocale("pt-br")).toBe("pt-BR");
    expect(canonicalLocale(" en ")).toBe("en");
    expect(canonicalLocale("not a locale")).toBeNull();
    expect(canonicalLocale("")).toBeNull();
    expect(canonicalLocale(42)).toBeNull();
  });

  it("auto deriva rtl de ar/he/fa/ur; ltr/rtl explícitos vencem", () => {
    expect(directionForLocale("ar")).toBe("rtl");
    expect(directionForLocale("ar-EG")).toBe("rtl");
    expect(directionForLocale("he-IL")).toBe("rtl");
    expect(directionForLocale("fa")).toBe("rtl");
    expect(directionForLocale("ur")).toBe("rtl");
    expect(directionForLocale("en")).toBe("ltr");
    expect(directionForLocale("ar", "ltr")).toBe("ltr");
    expect(directionForLocale("pt-BR", "rtl")).toBe("rtl");
  });

  it("valor salvo inválido conta como o padrão (pt-BR, auto)", () => {
    expect(parseDocumentLocale(undefined, undefined)).toEqual({ locale: "pt-BR", dir: "ltr" });
    expect(parseDocumentLocale("@@", "sideways")).toEqual({ locale: "pt-BR", dir: "ltr" });
    expect(parseDocumentLocale("ar", "auto")).toEqual({ locale: "ar", dir: "rtl" });
  });
});
