import { describe, expect, it, vi } from "vitest";
import type { ThemeSectionOverride } from "@/contexts/themes/contracts/v8";

// O barrel de contexts/themes puxa handlers com sessão/banco; aqui só a regra de prefixo reservado.
vi.mock("@/contexts/themes", async (importOriginal) => {
  const rules = await importOriginal<typeof import("@/contexts/themes")>();
  return { isReservedSectionPrefix: rules.isReservedSectionPrefix };
});

const { matchSectionOverride } = await import("./match-section-override");

const section = (id: string, pathPrefix: string, extra: Partial<ThemeSectionOverride> = {}): ThemeSectionOverride => ({
  id,
  label: id,
  pathPrefix,
  ...extra,
});

describe("matchSectionOverride (spec §7.3)", () => {
  const sections = [section("rh", "/rh", { themeKey: "aurora" }), section("rh-vagas", "/rh/vagas"), section("blog", "/blog")];

  it("prefixo mais longo em fronteira de segmento", () => {
    expect(matchSectionOverride(sections, "/rh", "public")?.id).toBe("rh");
    expect(matchSectionOverride(sections, "/rh/beneficios", "public")?.id).toBe("rh");
    expect(matchSectionOverride(sections, "/rh/vagas", "public")?.id).toBe("rh-vagas");
    expect(matchSectionOverride(sections, "/rh/vagas/123", "public")?.id).toBe("rh-vagas");
    expect(matchSectionOverride(sections, "/rhx", "public")).toBeNull();
    expect(matchSectionOverride(sections, "/", "public")).toBeNull();
  });

  it("a ordem do documento não importa", () => {
    expect(matchSectionOverride([...sections].reverse(), "/rh/vagas/1", "public")?.id).toBe("rh-vagas");
  });

  it("normaliza caminho e prefixo do mesmo jeito (maiúsculas, barra final, %XX, //)", () => {
    const encoded = [section("noticias", "/Notícias/")];
    expect(matchSectionOverride(encoded, "/not%C3%ADcias/ultima", "public")?.id).toBe("noticias");
    expect(matchSectionOverride(sections, "/RH//Vagas/", "public")?.id).toBe("rh-vagas");
  });

  it("nunca casa no admin nem sem caminho", () => {
    expect(matchSectionOverride(sections, "/rh", "admin")).toBeNull();
    expect(matchSectionOverride(sections, null, "public")).toBeNull();
  });

  it("prefixos reservados são ignorados mesmo se chegarem ao documento", () => {
    const reserved = [section("raiz", "/"), section("adm", "/admin"), section("ext", "/ext/tv"), section("api", "/api"), section("login", "/login")];
    for (const path of ["/", "/qualquer", "/admin/x", "/ext/tv/1", "/api/health", "/login"]) {
      expect(matchSectionOverride(reserved, path, "public")).toBeNull();
    }
  });
});
