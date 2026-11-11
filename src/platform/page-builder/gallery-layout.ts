// Opções e classes do bloco de galeria (core.layout.gallery) — puro, sem React nem banco, pra ser
// testado e compartilhado entre o renderer (server) e o lightbox (client). As strings de classe
// ficam inteiras aqui porque o Tailwind só enxerga classe escrita por extenso.

export type GalleryVariant = "grid" | "mural";
export type GalleryAspect = "auto" | "10-9" | "4-3" | "1-1";
export type GalleryGap = "sm" | "md" | "lg";

export type GalleryOptions = {
  variant: GalleryVariant;
  lightbox: boolean;
  aspect: GalleryAspect;
  // Máximo de colunas no desktop (o mural sempre começa em 2 no mobile).
  columns: 2 | 3 | 4;
  gap: GalleryGap;
};

const ASPECTS: readonly GalleryAspect[] = ["auto", "10-9", "4-3", "1-1"];
const GAPS: readonly GalleryGap[] = ["sm", "md", "lg"];

// Dado salvo antes dos campos novos (só columns/gap) cai em { variant: "grid", lightbox: false,
// aspect: "auto" } — mesmo comportamento de sempre.
export function resolveGalleryOptions(data: Record<string, unknown>): GalleryOptions {
  const columnsRaw = Number(data.columns);
  const columns = columnsRaw === 2 || columnsRaw === 4 ? columnsRaw : 3;
  const aspect = ASPECTS.find((value) => value === data.aspect) ?? "auto";
  const gap = GAPS.find((value) => value === data.gap) ?? "md";
  return {
    variant: data.variant === "mural" ? "mural" : "grid",
    lightbox: data.lightbox === true,
    aspect,
    columns,
    gap,
  };
}

// Mural: mobile-first, 2 colunas desde o celular → 3 no sm → `columns` (até 4) no lg.
export const MURAL_COLUMN_CLASSES: Record<GalleryOptions["columns"], string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
};

export const MURAL_GAP_CLASSES: Record<GalleryGap, string> = {
  sm: "gap-2 sm:gap-3",
  md: "gap-3 sm:gap-4",
  lg: "gap-4 sm:gap-6",
};

export const GALLERY_ASPECT_CLASSES: Record<GalleryAspect, string> = {
  auto: "",
  "10-9": "aspect-[10/9]",
  "4-3": "aspect-[4/3]",
  "1-1": "aspect-square",
};

// Largura CSS aproximada de um card do mural (px) — alimenta a escolha da variante (a menor que
// cobre a largura na densidade 2x). 260 px cobre o card de 4 colunas no desktop e o de 2 no celular.
export const MURAL_THUMB_DISPLAY_WIDTH = 260;

// Índice anterior/próximo do lightbox, circular.
export function wrapIndex(current: number, delta: number, total: number): number {
  if (total <= 0) return 0;
  return (((current + delta) % total) + total) % total;
}
