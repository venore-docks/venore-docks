import { describe, expect, it } from "vitest";
import { entryFeedGridClasses, isFeaturedLayout, parseEntryFeedData } from "./entry-feed-data";

describe("parseEntryFeedData", () => {
  it("aplica os padrões quando o bloco está vazio", () => {
    expect(parseEntryFeedData({})).toEqual({ title: "", categorySlug: "noticias", typeKey: null, limit: 3, viewAllLabel: "" });
  });

  it("normaliza o slug (aceita barras nas pontas e espaços)", () => {
    expect(parseEntryFeedData({ categorySlug: " /recursos-humanos/ " }).categorySlug).toBe("recursos-humanos");
  });

  it("limita a quantidade entre 1 e 12 e aceita número em texto", () => {
    expect(parseEntryFeedData({ limit: 0 }).limit).toBe(1);
    expect(parseEntryFeedData({ limit: 99 }).limit).toBe(12);
    expect(parseEntryFeedData({ limit: "4" }).limit).toBe(4);
    expect(parseEntryFeedData({ limit: 2.9 }).limit).toBe(2);
    expect(parseEntryFeedData({ limit: "abc" }).limit).toBe(3);
    expect(parseEntryFeedData({ limit: Number.NaN }).limit).toBe(3);
  });

  it("ignora campos de tipo errado", () => {
    expect(parseEntryFeedData({ title: 5, viewAllLabel: {}, categorySlug: null })).toEqual({
      title: "",
      categorySlug: "noticias",
      typeKey: null,
      limit: 3,
      viewAllLabel: "",
    });
  });

  it("lê o tipo (content type) opcional: normaliza e rejeita formato inválido", () => {
    expect(parseEntryFeedData({ typeKey: " Campanhas " }).typeKey).toBe("campanhas");
    expect(parseEntryFeedData({ typeKey: "" }).typeKey).toBeNull();
    expect(parseEntryFeedData({ typeKey: "../x" }).typeKey).toBeNull();
    expect(parseEntryFeedData({ typeKey: 7 }).typeKey).toBeNull();
  });
});

describe("layout do feed", () => {
  it("destaca o primeiro card só com 3 publicações", () => {
    expect([1, 2, 3, 4, 5, 6].map(isFeaturedLayout)).toEqual([false, false, true, false, false, false]);
  });

  it("grade mobile-first conforme a quantidade", () => {
    expect(entryFeedGridClasses(1)).toBe("grid-cols-1");
    expect(entryFeedGridClasses(2)).toBe("grid-cols-1 sm:grid-cols-2");
    expect(entryFeedGridClasses(3)).toContain("lg:grid-cols-3");
    expect(entryFeedGridClasses(4)).not.toContain("lg:grid-cols-3");
  });
});
