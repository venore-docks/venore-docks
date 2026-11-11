import { describe, expect, it } from "vitest";
import { GALLERY_ASPECT_CLASSES, MURAL_COLUMN_CLASSES, resolveGalleryOptions, wrapIndex } from "./gallery-layout";

describe("resolveGalleryOptions", () => {
  it("dado antigo (só columns/gap) vira grade simples sem lightbox", () => {
    expect(resolveGalleryOptions({ columns: 3, gap: "md" })).toEqual({ variant: "grid", lightbox: false, aspect: "auto", columns: 3, gap: "md" });
  });

  it("lê mural, lightbox e proporção", () => {
    expect(resolveGalleryOptions({ variant: "mural", lightbox: true, aspect: "10-9", columns: "4", gap: "lg" })).toEqual({
      variant: "mural",
      lightbox: true,
      aspect: "10-9",
      columns: 4,
      gap: "lg",
    });
  });

  it("valores inválidos caem no padrão", () => {
    expect(resolveGalleryOptions({ variant: "x", lightbox: "true", aspect: "16-9", columns: 9, gap: "xl" })).toEqual({
      variant: "grid",
      lightbox: false,
      aspect: "auto",
      columns: 3,
      gap: "md",
    });
  });
});

describe("classes do mural", () => {
  it("começa em 2 colunas no celular e respeita o máximo de colunas", () => {
    expect(MURAL_COLUMN_CLASSES[2]).toBe("grid-cols-2");
    expect(MURAL_COLUMN_CLASSES[3]).toBe("grid-cols-2 sm:grid-cols-3");
    expect(MURAL_COLUMN_CLASSES[4]).toBe("grid-cols-2 sm:grid-cols-3 lg:grid-cols-4");
  });

  it("proporção 'auto' não fixa aspect-ratio", () => {
    expect(GALLERY_ASPECT_CLASSES.auto).toBe("");
    expect(GALLERY_ASPECT_CLASSES["10-9"]).toBe("aspect-[10/9]");
  });
});

describe("wrapIndex", () => {
  it("anda e dá a volta nas duas pontas", () => {
    expect(wrapIndex(0, -1, 5)).toBe(4);
    expect(wrapIndex(4, 1, 5)).toBe(0);
    expect(wrapIndex(2, 1, 5)).toBe(3);
  });

  it("lista vazia devolve 0", () => {
    expect(wrapIndex(0, 1, 0)).toBe(0);
  });
});
