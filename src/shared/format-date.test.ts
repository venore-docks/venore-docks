import { describe, expect, it } from "vitest";
import { formatDate } from "./format-date";

const iso = "2026-03-15T12:00:00Z";

describe("formatDate", () => {
  it("formata no locale pedido", () => {
    expect(formatDate(iso, "pt-BR", "long")).toBe("15 de março de 2026");
    expect(formatDate(iso, "en-US", "long")).toBe("March 15, 2026");
    expect(formatDate(new Date(iso), "pt-BR", { timeZone: "UTC", dateStyle: "short" })).toBe("15/03/2026");
  });

  it("locale inválido ou ausente cai no pt-BR", () => {
    expect(formatDate(iso, "@@invalid", "long")).toBe("15 de março de 2026");
    expect(formatDate(iso, null, "long")).toBe("15 de março de 2026");
  });

  it("data ausente ou inválida devolve null", () => {
    expect(formatDate(null, "pt-BR")).toBeNull();
    expect(formatDate("not a date", "pt-BR")).toBeNull();
  });
});
