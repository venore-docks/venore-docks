// Fontes (spec §2.9 / §7.6). Só ids desta lista viram --theme-font-* no CSS de runtime (whitelist).
export const FONT_IDS = [
  "geist",
  "geist-mono",
  "inter",
  "manrope",
  "space-grotesk",
  "fraunces",
  "playfair-display",
  "source-serif-4",
  "jetbrains-mono",
  "ibm-plex-mono",
  "noto-sans-arabic",
  "noto-sans-hebrew",
] as const;
export type FontId = (typeof FONT_IDS)[number];
export type FontRole = "sans" | "display" | "mono";
export const FONT_ROLES: readonly FontRole[] = ["sans", "display", "mono"];
