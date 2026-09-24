import type { PaletteColorTokens } from "@/contexts/themes";
import { oklchToHex, type Oklch } from "./oklch-color";

// Gera uma paleta COMPLETA (9 tokens, os dois modos) a partir de 1 cor só — pedido de sessão:
// "1 cor de marca" tava só girando o matiz dos 5 tokens de marca (primary/-foreground, accent/
// -foreground, ring) sobre a base do tema ativo, deixando os outros 4 tokens (secondary/-
// foreground, background, foreground) sem valor nenhum (apareciam pretos no formulário Avançado —
// UNSET_FALLBACK). Esta versão monta os 9 de uma vez, com regras de composição fixas (shades da
// cor de entrada pra secundária/fundo, acentuação na cor COMPLEMENTAR pro destaque), sem depender
// do catálogo do tema ativo — o admin ainda pode reescrever qualquer token à mão depois em
// Avançado.

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const normalizeHue = (hue: number) => ((hue % 360) + 360) % 360;

function toHex(l: number, c: number, h: number): string {
  return oklchToHex(clamp01(l), Math.max(0, c), normalizeHue(h));
}

// Empurra a luminosidade da cor de entrada pra faixa que ainda lê bem sobre fundo escuro
// (0.55–0.84 — mesma faixa observada nos primary/dark dos 16 temas do workspace), sem perder o
// tom original: puxa em direção a 0.7 proporcional à distância.
function deriveDarkTone(l0: number): number {
  return clamp01(l0 + (0.7 - l0) * 0.6);
}

// Texto de cima de um token: quase-preto sobre fundo claro, quase-branco sobre fundo escuro —
// mesmo limiar (L 0.6) e mesma faixa (~0.18 / ~0.97) que todo theme.css do workspace usa pros
// pares -foreground. Chroma bem baixa (não zero: um traço do matiz de marca, não cinza puro).
function contrastingForeground(baseL: number, hue: number, chromaScale: number): string {
  return baseL > 0.6 ? toHex(0.18, chromaScale * 0.04, hue) : toHex(0.97, chromaScale * 0.02, hue);
}

// Fração da chroma da cor de entrada usada nos tons estruturais — proporcional (não fixa), pra
// fundo/secundária carregarem alguma identidade da cor de marca (não virarem cinza puro), mas sem
// competir com primary/accent pela atenção. Valores deliberadamente mais altos que o que os temas
// hand-tuned do workspace usam (lá é quase 0 — chroma ~0.002–0.006, resultado imperceptível): aqui
// o objetivo é o oposto, o admin PERCEBER que a paleta toda mudou.
const BACKGROUND_CHROMA_RATIO = 0.05;
const SECONDARY_CHROMA_RATIO = 0.18;
const ACCENT_CHROMA_RATIO = 0.9;

const LIGHT_BACKGROUND_L = 0.985;
const LIGHT_SECONDARY_L = 0.96;
const DARK_BACKGROUND_L = 0.16;
const DARK_SECONDARY_L = 0.26;

function buildMode(l0: number, c0: number, h0: number, backgroundL: number, secondaryL: number): PaletteColorTokens {
  const complementHue = normalizeHue(h0 + 180);
  const accentC = c0 * ACCENT_CHROMA_RATIO;
  const secondaryC = c0 * SECONDARY_CHROMA_RATIO;
  const backgroundC = c0 * BACKGROUND_CHROMA_RATIO;

  return {
    primary: toHex(l0, c0, h0),
    "primary-foreground": contrastingForeground(l0, h0, c0),
    ring: toHex(l0, c0, h0),
    accent: toHex(l0, accentC, complementHue),
    "accent-foreground": contrastingForeground(l0, complementHue, accentC),
    secondary: toHex(secondaryL, secondaryC, h0),
    "secondary-foreground": contrastingForeground(secondaryL, h0, secondaryC),
    background: toHex(backgroundL, backgroundC, h0),
    foreground: contrastingForeground(backgroundL, h0, backgroundC),
  };
}

// Pura — sem I/O. `seed` é a cor de entrada (hex do admin, ou o `primary` de um preset do
// catálogo) já em OKLCH. Modo claro usa a cor de entrada como está; modo escuro deriva um tom que
// ainda contrasta sobre fundo escuro (deriveDarkTone) — mesma cor "de marca", ajustada por modo,
// igual todo tema do workspace já faz entre seu bloco base e `.dark`.
export function buildFullPaletteFromSeed(seed: Oklch): { light: PaletteColorTokens; dark: PaletteColorTokens } {
  const { l: l0, c: c0, h: h0 } = seed;
  const darkL = deriveDarkTone(l0);

  return {
    light: buildMode(l0, c0, h0, LIGHT_BACKGROUND_L, LIGHT_SECONDARY_L),
    dark: buildMode(darkL, c0, h0, DARK_BACKGROUND_L, DARK_SECONDARY_L),
  };
}
