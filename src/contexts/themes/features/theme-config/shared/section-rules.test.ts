import { describe, expect, it } from "vitest";
import { isReservedSectionPrefix, normalizeSectionOverrides } from "./section-rules";

describe("regras de seção (spec §2.13/§7.3)", () => {
  it("reservados: raiz, /admin, /ext, /api, /login (em fronteira de segmento)", () => {
    for (const prefix of ["/", "", "/admin", "/ADMIN/", "/admin/x", "/ext", "/ext/tv", "/api", "api/x", "/login", "/_next"]) {
      expect(isReservedSectionPrefix(prefix)).toBe(true);
    }
    for (const prefix of ["/rh", "/administracao", "/extra", "/apiario", "/logins"]) {
      expect(isReservedSectionPrefix(prefix)).toBe(false);
    }
  });

  it("normaliza os prefixos com normalizePathPrefix", () => {
    const result = normalizeSectionOverrides([{ id: "a", label: "A", pathPrefix: "RH//Vagas/" }]);
    expect(result).toEqual({ success: true, data: [{ id: "a", label: "A", pathPrefix: "/rh/vagas" }] });
  });

  it("recusa prefixo reservado, prefixo repetido (após normalizar) e id repetido", () => {
    expect(normalizeSectionOverrides([{ id: "a", label: "A", pathPrefix: "/admin/x" }])).toMatchObject({
      success: false,
      error: { code: "themes.config.section_reserved_prefix" },
    });
    expect(
      normalizeSectionOverrides([
        { id: "a", label: "A", pathPrefix: "/rh" },
        { id: "b", label: "B", pathPrefix: "/RH/" },
      ]),
    ).toMatchObject({ success: false, error: { code: "themes.config.section_duplicate_prefix" } });
    expect(
      normalizeSectionOverrides([
        { id: "a", label: "A", pathPrefix: "/rh" },
        { id: "a", label: "B", pathPrefix: "/blog" },
      ]),
    ).toMatchObject({ success: false, error: { code: "themes.config.section_duplicate_id" } });
  });
});
