// Conversão hex <-> OKLCH (matrizes de Björn Ottosson, https://bottosson.github.io/posts/oklab/).
// Sem biblioteca de cor: nenhuma está declarada como dependência do projeto (as que aparecem em
// node_modules são transitivas de tooling — eslint/vitest — e nenhuma expõe OKLab/OKLCH mesmo
// assim). Mesmo estilo dos parsers regex já existentes em generate-hue-rotation-palettes.ts/
// contrast.ts: matemática pura, sem I/O.
//
// Usada pelo fluxo "1 cor de marca" (brand-color-palette.ts): o admin escolhe 1 hex, extraímos o
// matiz (hue) dele, e reaplicamos esse matiz sobre o L/C de cada token de marca do tema ativo —
// por isso as duas direções (hex->oklch pra ler o input, oklch->hex pra devolver algo gravável em
// theme.customColorPalette.<themeKey>, que só aceita #rrggbb).

const HEX_PATTERN = /^#([0-9a-f]{6})$/i;

function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel: number): number {
  return channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
}

export type Oklch = { l: number; c: number; h: number };

// Assume hex já validado (HEX_PATTERN) pelo chamador — não lança, só não faz sentido chamar com
// entrada crua do FormData sem validar antes (mesma divisão de responsabilidade de
// custom-color-palette.ts: validação de formato fica com quem grava).
export function hexToOklch(hex: string): Oklch {
  const match = HEX_PATTERN.exec(hex);
  const value = Number.parseInt(match ? match[1] : "000000", 16);

  const r = srgbToLinear(((value >> 16) & 0xff) / 255);
  const g = srgbToLinear(((value >> 8) & 0xff) / 255);
  const b = srgbToLinear((value & 0xff) / 255);

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bLab = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const c = Math.sqrt(a * a + bLab * bLab);
  const hueDeg = (Math.atan2(bLab, a) * 180) / Math.PI;

  return { l: L, c, h: hueDeg < 0 ? hueDeg + 360 : hueDeg };
}

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value * 255)));
}

function byteToHex(byte: number): string {
  return byte.toString(16).padStart(2, "0");
}

// Gamut clamp simples: satura o canal fora de [0,1] em vez de mapear perceptualmente — combinação
// de L/C/H fora do sRGB (comum em matiz+chroma altos) ainda produz um #rrggbb válido, só um pouco
// menos saturado do que o alvo matemático. Aceitável aqui — não vale a complexidade de gamut
// mapping completo pra um color picker de admin.
export function oklchToHex(l: number, c: number, h: number): string {
  const hueRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hueRad);
  const bLab = c * Math.sin(hueRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * bLab;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * bLab;
  const s_ = l - 0.0894841775 * a - 1.291485548 * bLab;

  const lCubed = l_ ** 3;
  const mCubed = m_ ** 3;
  const sCubed = s_ ** 3;

  const r = 4.0767416621 * lCubed - 3.3077115913 * mCubed + 0.2309699292 * sCubed;
  const g = -1.2684380046 * lCubed + 2.6097574011 * mCubed - 0.3413193965 * sCubed;
  const b = -0.0041960863 * lCubed - 0.7034186147 * mCubed + 1.707614701 * sCubed;

  const rByte = clampByte(linearToSrgb(r));
  const gByte = clampByte(linearToSrgb(g));
  const bByte = clampByte(linearToSrgb(b));

  return `#${byteToHex(rByte)}${byteToHex(gByte)}${byteToHex(bByte)}`;
}

export function isValidHexColor(value: string): boolean {
  return HEX_PATTERN.test(value);
}

// Parser numérico de "oklch(L C H)" — deliberadamente separado do parseOklch (string-preserving)
// de src/themes/generate-hue-rotation-palettes.ts, que outros testes já dependem devolver L/C como
// string intacta. Este devolve number pra alimentar oklchToHex. Aceita também `L%`, `none` e o
// alpha `/ A` (ignorado aqui — quem precisa do alpha usa parseCssColor).
export function parseOklchNumeric(value: string): Oklch | null {
  const parsed = parseOklchFunction(value.trim());
  return parsed ? { l: parsed.l, c: parsed.c, h: parsed.h } : null;
}

// ── v8 (W1): cor CSS completa ──────────────────────────────────────────────────────────────────
// Cor resolvida em OKLCH + alpha. `hueMissing` marca hue `none` ou "powerless" (chroma ~0) — em
// color-mix() o hue ausente assume o da outra cor (CSS Color 4 §12.4), senão um cinza puxaria o
// matiz pra 0°.
export type CssColor = Oklch & { alpha: number; hueMissing: boolean };

const NUMBER = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?`;
const COMPONENT = new RegExp(String.raw`^(${NUMBER})(%|deg)?$`, "i");
const ACHROMATIC_CHROMA = 1e-6;

// Componente numérico de função de cor: `0.5`, `50%`, `120deg`, `none`. `percentScale` converte %
// (L: 100% = 1; C: 100% = 0.4; alpha: 100% = 1). null = inválido; NaN = `none`.
function parseComponent(token: string, percentScale: number): number | null {
  if (token.toLowerCase() === "none") return Number.NaN;
  const match = COMPONENT.exec(token);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  return match[2] === "%" ? (value / 100) * percentScale : value;
}

// Separa "a b c / d" (ou "a, b, c, d" da sintaxe legada de rgb) em componentes + alpha.
function splitFunctionArgs(body: string): { parts: string[]; alpha: string | null } | null {
  const [main, alpha, extra] = body.split("/");
  if (extra !== undefined) return null;
  const parts = main.includes(",") ? main.split(",").map((part) => part.trim()) : main.trim().split(/\s+/);
  if (main.includes(",") && parts.length === 4 && alpha === undefined) return { parts: parts.slice(0, 3), alpha: parts[3] };
  return { parts, alpha: alpha === undefined ? null : alpha.trim() };
}

function parseAlpha(token: string | null): number | null {
  if (token === null) return 1;
  const value = parseComponent(token, 1);
  if (value === null) return null;
  return Number.isNaN(value) ? 0 : Math.min(1, Math.max(0, value));
}

function parseOklchFunction(value: string): CssColor | null {
  const match = /^oklch\(\s*([^)]*)\)$/i.exec(value);
  if (!match) return null;
  const args = splitFunctionArgs(match[1]);
  if (!args || args.parts.length !== 3) return null;
  const l = parseComponent(args.parts[0], 1);
  const c = parseComponent(args.parts[1], 0.4);
  const h = parseComponent(args.parts[2].replace(/deg$/i, ""), 1);
  const alpha = parseAlpha(args.alpha);
  if (l === null || c === null || h === null || alpha === null) return null;
  const chroma = Number.isNaN(c) ? 0 : Math.max(0, c);
  const hueMissing = Number.isNaN(h) || chroma < ACHROMATIC_CHROMA;
  return {
    l: Number.isNaN(l) ? 0 : l,
    c: chroma,
    h: Number.isNaN(h) ? 0 : ((h % 360) + 360) % 360,
    alpha,
    hueMissing,
  };
}

function fromSrgb(r: number, g: number, b: number, alpha: number): CssColor {
  const hex = `#${[r, g, b].map((channel) => byteToHex(clampByte(channel))).join("")}`;
  const { l, c, h } = hexToOklch(hex);
  return { l, c, h, alpha, hueMissing: c < ACHROMATIC_CHROMA };
}

function parseHexColor(value: string): CssColor | null {
  const match = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value);
  if (!match) return null;
  let digits = match[1];
  if (digits.length <= 4) digits = [...digits].map((digit) => digit + digit).join("");
  const channel = (index: number) => Number.parseInt(digits.slice(index * 2, index * 2 + 2), 16) / 255;
  return fromSrgb(channel(0), channel(1), channel(2), digits.length === 8 ? channel(3) : 1);
}

function parseRgbFunction(value: string): CssColor | null {
  const match = /^rgba?\(\s*([^)]*)\)$/i.exec(value);
  if (!match) return null;
  const args = splitFunctionArgs(match[1]);
  if (!args || args.parts.length !== 3) return null;
  // rgb(): número 0–255 ou %, onde 100% = 255.
  const channels = args.parts.map((part) => parseComponent(part, 255));
  const alpha = parseAlpha(args.alpha);
  if (channels.some((channel) => channel === null) || alpha === null) return null;
  const [r, g, b] = channels.map((channel) => (Number.isNaN(channel!) ? 0 : channel!) / 255);
  return fromSrgb(r, g, b, alpha);
}

const NAMED_COLORS: Record<string, string> = { white: "#ffffff", black: "#000000" };

// Cor CSS literal → OKLCH + alpha. Aceita hex (#rgb/#rgba/#rrggbb/#rrggbbaa), oklch() (com `%`,
// `deg`, `none` e `/ alpha`), rgb()/rgba(), `transparent`, `white` e `black`. var() e color-mix()
// são resolvidos em token-values.ts (precisam do mapa de tokens). null = não é cor literal.
export function parseCssColor(value: string): CssColor | null {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "transparent") return { l: 0, c: 0, h: 0, alpha: 0, hueMissing: true };
  if (NAMED_COLORS[lower]) return parseHexColor(NAMED_COLORS[lower]);
  if (trimmed.startsWith("#")) return parseHexColor(trimmed);
  if (/^oklch\(/i.test(trimmed)) return parseOklchFunction(trimmed);
  if (/^rgba?\(/i.test(trimmed)) return parseRgbFunction(trimmed);
  return null;
}

// color-mix(in oklch, A p%, B q%) — CSS Color 5 §2: normaliza as porcentagens (ausente = 100 − a
// outra; soma < 100 reduz o alpha), interpola em alpha pré-multiplicado e o hue pelo arco mais
// curto. `weightA` já normalizado em [0,1]; `alphaScale` = soma/100 quando a soma é < 100.
export function mixOklch(a: CssColor, b: CssColor, weightA: number, alphaScale = 1): CssColor {
  const weightB = 1 - weightA;
  const alpha = a.alpha * weightA + b.alpha * weightB;
  const premultiplied = (channelA: number, channelB: number) =>
    alpha === 0 ? channelA * weightA + channelB * weightB : (channelA * a.alpha * weightA + channelB * b.alpha * weightB) / alpha;

  let hue: number;
  let hueMissing = false;
  if (a.hueMissing && b.hueMissing) {
    hue = 0;
    hueMissing = true;
  } else if (a.hueMissing) {
    hue = b.h;
  } else if (b.hueMissing) {
    hue = a.h;
  } else {
    let delta = b.h - a.h;
    if (delta > 180) delta -= 360;
    else if (delta < -180) delta += 360;
    hue = (((a.h + delta * weightB) % 360) + 360) % 360;
  }

  const l = premultiplied(a.l, b.l);
  const c = premultiplied(a.c, b.c);
  return { l, c, h: hue, alpha: alpha * alphaScale, hueMissing: hueMissing || c < ACHROMATIC_CHROMA };
}

// OKLCH → sRGB não-linear em [0,1] (clamp simples por canal, mesmo critério de oklchToHex).
export function oklchToSrgb(l: number, c: number, h: number): { r: number; g: number; b: number } {
  const hex = oklchToHex(l, c, h);
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: ((value >> 16) & 0xff) / 255, g: ((value >> 8) & 0xff) / 255, b: (value & 0xff) / 255 };
}

// Serialização curta e estável — o formato estrito aceito por THEME_COLOR_VALUE_PATTERN
// (config-document) e pelo whitelist de buildPaletteCss.
export function formatOklch(color: Oklch & { alpha?: number }): string {
  const round = (value: number, digits: number) => Number(value.toFixed(digits)).toString();
  const body = `${round(Math.min(1, Math.max(0, color.l)), 4)} ${round(Math.max(0, color.c), 4)} ${round(color.h, 2)}`;
  return color.alpha !== undefined && color.alpha < 1 ? `oklch(${body} / ${round(color.alpha, 3)})` : `oklch(${body})`;
}
