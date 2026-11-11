import { describe, expect, it } from "vitest";
import { categoryHref, parseTypeKey } from "./category-href";

describe("parseTypeKey", () => {
  it("aceita key de content type e normaliza caixa", () => {
    expect(parseTypeKey("campanhas")).toBe("campanhas");
    expect(parseTypeKey(" Noticias-da-FEM ")).toBe("noticias-da-fem");
  });
  it("rejeita vazio, ausente e formato inválido", () => {
    expect(parseTypeKey(undefined)).toBeNull();
    expect(parseTypeKey("")).toBeNull();
    expect(parseTypeKey("a b")).toBeNull();
    expect(parseTypeKey("../x")).toBeNull();
    expect(parseTypeKey("x".repeat(81))).toBeNull();
  });
  it("usa o primeiro valor de um parâmetro repetido", () => {
    expect(parseTypeKey(["campanhas", "outro"])).toBe("campanhas");
  });
});

describe("categoryHref", () => {
  it("sem opções devolve só o caminho", () => {
    expect(categoryHref("/noticias")).toBe("/noticias");
    expect(categoryHref("/noticias", { page: 1 })).toBe("/noticias");
  });
  it("preserva o tipo e a página", () => {
    expect(categoryHref("/noticias", { typeKey: "campanhas" })).toBe("/noticias?tipo=campanhas");
    expect(categoryHref("/noticias", { typeKey: "campanhas", page: 3 })).toBe("/noticias?tipo=campanhas&page=3");
    expect(categoryHref("/noticias", { page: 2 })).toBe("/noticias?page=2");
  });
});
