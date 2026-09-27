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
// string intacta. Este devolve number pra alimentar oklchToHex.
export function parseOklchNumeric(value: string): Oklch | null {
  const match = value.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/i);
  if (!match) return null;
  return { l: Number(match[1]), c: Number(match[2]), h: Number(match[3]) };
}
