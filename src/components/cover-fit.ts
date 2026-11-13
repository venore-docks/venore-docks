// Como encaixar uma capa numa moldura horizontal (card 16/10, 16/9, hero). Puro, sem React — testável.
//
// Arte de Instagram (1080x1350, 1080x1080) e story (1080x1920) cortada em object-cover numa moldura
// 16/10 perde título, data e metade do cartaz. Abaixo deste limiar a capa é exibida inteira
// (object-contain) sobre uma cópia desfocada dela mesma, que preenche as laterais. Foto horizontal
// (3:2 = 1.5, 16:9 = 1.78) continua em object-cover, como sempre.
export const CONTAIN_COVER_MAX_RATIO = 1.3;

export type CoverFit = "cover" | "contain";

// Dimensão desconhecida (asset antigo sem width/height) = "cover", o comportamento de antes.
export function resolveCoverFit(width: number | null | undefined, height: number | null | undefined): CoverFit {
  if (!width || !height || width <= 0 || height <= 0) return "cover";
  return width / height < CONTAIN_COVER_MAX_RATIO ? "contain" : "cover";
}
