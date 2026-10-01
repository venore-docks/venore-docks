import type { PaletteColorTokens } from "@/contexts/themes";
import { oklchToHex, type Oklch } from "./oklch-color";

// Gera uma paleta COMPLETA a partir de 1 cor só — pedido de sessão: a v0.3.0 já cobria os 9
// tokens de "hue de marca"/estrutura básica, mas a sidebar (e header/fundo de página) nunca
// mudavam de cor. Investigando o theme.css dos 16 temas + venore-slime, achamos que sidebar/
// header/app-background usam uma família de tokens própria (--sidebar-bg-start/end (+admin),
// --header-bg, --app-bg-start/mid/end), consistente em todo o workspace (mesmo scaffold de
// @venore/theme-sdk) mas fora do vocabulário que esta função cobria — por isso pareciam
// "hardcoded" na prática (não são: são var(...) legítimo, só não estavam no PaletteColorToken).
// Esta versão cobre os 25 tokens do union inteiro.

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
// cada superfície carregar algum traço da cor de marca (não virar cinza puro), mas sem competir
// com primary/accent pela atenção. Valores deliberadamente mais altos que o que os temas
// hand-tuned do workspace usam (lá é quase 0 — chroma ~0.002–0.006, resultado imperceptível): aqui
// o objetivo é o oposto, o admin PERCEBER que a paleta toda mudou.
const BACKGROUND_CHROMA_RATIO = 0.05;
const SECONDARY_CHROMA_RATIO = 0.18;
const ACCENT_CHROMA_RATIO = 0.9;
const CARD_CHROMA_RATIO = 0.03;
const BORDER_CHROMA_RATIO = 0.12;
const SIDEBAR_CHROMA_RATIO = 0.24;

// L alvo por token, por modo — mesma faixa observada nos 16 temas do workspace (background quase
// branco/preto, card levemente acima, muted/secondary um degrau abaixo, border mais um degrau,
// sidebar mais escura ainda que o resto do claro — segue o padrão predominante entre os 16 temas
// de a sidebar acompanhar o modo, não o "rail sempre escuro" que só a família Aurora usa).
const LIGHT_BACKGROUND_L = 0.985;
const LIGHT_CARD_L = 1;
const LIGHT_SECONDARY_L = 0.96;
const LIGHT_BORDER_L = 0.88;
const LIGHT_MUTED_FOREGROUND_L = 0.52;
const LIGHT_SIDEBAR_START_L = 0.94;
const LIGHT_SIDEBAR_END_L = 0.9;
const LIGHT_APP_BG_START_L = 0.99;
const LIGHT_APP_BG_MID_L = 0.985;
const LIGHT_APP_BG_END_L = 0.978;

const DARK_BACKGROUND_L = 0.16;
const DARK_CARD_L = 0.2;
const DARK_SECONDARY_L = 0.26;
const DARK_BORDER_L = 0.3;
const DARK_MUTED_FOREGROUND_L = 0.62;
const DARK_SIDEBAR_START_L = 0.19;
const DARK_SIDEBAR_END_L = 0.15;
const DARK_APP_BG_START_L = 0.17;
const DARK_APP_BG_MID_L = 0.155;
const DARK_APP_BG_END_L = 0.13;

type ModeLevels = {
  background: number;
  card: number;
  secondary: number;
  border: number;
  mutedForeground: number;
  sidebarStart: number;
  sidebarEnd: number;
  appBgStart: number;
  appBgMid: number;
  appBgEnd: number;
};

const LIGHT_LEVELS: ModeLevels = {
  background: LIGHT_BACKGROUND_L,
  card: LIGHT_CARD_L,
  secondary: LIGHT_SECONDARY_L,
  border: LIGHT_BORDER_L,
  mutedForeground: LIGHT_MUTED_FOREGROUND_L,
  sidebarStart: LIGHT_SIDEBAR_START_L,
  sidebarEnd: LIGHT_SIDEBAR_END_L,
  appBgStart: LIGHT_APP_BG_START_L,
  appBgMid: LIGHT_APP_BG_MID_L,
  appBgEnd: LIGHT_APP_BG_END_L,
};

const DARK_LEVELS: ModeLevels = {
  background: DARK_BACKGROUND_L,
  card: DARK_CARD_L,
  secondary: DARK_SECONDARY_L,
  border: DARK_BORDER_L,
  mutedForeground: DARK_MUTED_FOREGROUND_L,
  sidebarStart: DARK_SIDEBAR_START_L,
  sidebarEnd: DARK_SIDEBAR_END_L,
  appBgStart: DARK_APP_BG_START_L,
  appBgMid: DARK_APP_BG_MID_L,
  appBgEnd: DARK_APP_BG_END_L,
};

function buildMode(l0: number, c0: number, h0: number, levels: ModeLevels): PaletteColorTokens {
  const complementHue = normalizeHue(h0 + 180);
  const accentC = c0 * ACCENT_CHROMA_RATIO;
  const secondaryC = c0 * SECONDARY_CHROMA_RATIO;
  const backgroundC = c0 * BACKGROUND_CHROMA_RATIO;
  const cardC = c0 * CARD_CHROMA_RATIO;
  const borderC = c0 * BORDER_CHROMA_RATIO;
  const sidebarC = c0 * SIDEBAR_CHROMA_RATIO;

  return {
    primary: toHex(l0, c0, h0),
    "primary-foreground": contrastingForeground(l0, h0, c0),
    ring: toHex(l0, c0, h0),
    accent: toHex(l0, accentC, complementHue),
    "accent-foreground": contrastingForeground(l0, complementHue, accentC),
    secondary: toHex(levels.secondary, secondaryC, h0),
    "secondary-foreground": contrastingForeground(levels.secondary, h0, secondaryC),
    background: toHex(levels.background, backgroundC, h0),
    foreground: contrastingForeground(levels.background, h0, backgroundC),
    card: toHex(levels.card, cardC, h0),
    "card-foreground": contrastingForeground(levels.card, h0, cardC),
    popover: toHex(levels.card, cardC, h0),
    "popover-foreground": contrastingForeground(levels.card, h0, cardC),
    muted: toHex(levels.secondary, secondaryC, h0),
    "muted-foreground": toHex(levels.mutedForeground, secondaryC, h0),
    border: toHex(levels.border, borderC, h0),
    input: toHex(levels.border, borderC, h0),
    "sidebar-bg-start": toHex(levels.sidebarStart, sidebarC, h0),
    "sidebar-bg-end": toHex(levels.sidebarEnd, sidebarC, h0),
    "sidebar-bg-admin-start": toHex(levels.sidebarStart, sidebarC, h0),
    "sidebar-bg-admin-end": toHex(levels.sidebarEnd, sidebarC, h0),
    "header-bg": toHex(levels.card, cardC, h0),
    "app-bg-start": toHex(levels.appBgStart, backgroundC, h0),
    "app-bg-mid": toHex(levels.appBgMid, backgroundC, h0),
    "app-bg-end": toHex(levels.appBgEnd, backgroundC, h0),
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
    light: buildMode(l0, c0, h0, LIGHT_LEVELS),
    dark: buildMode(darkL, c0, h0, DARK_LEVELS),
  };
}
