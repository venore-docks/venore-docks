import type { ThemeTokenRegion } from "./enums";

// Regras de paleta (spec §2.4) — tons por região, tokens travados, presets, cor custom.
export type RegionTone = "inherit" | "light" | "dark" | "brand";
export type ThemePaletteRules = {
  regions?: Partial<Record<ThemeTokenRegion, { tone: RegionTone; minContrast?: number }>>;
  lockedTokens?: readonly string[];
  accent?: "complement" | "analogous" | "same" | "neutral";
  presets?: readonly { id: string; name: string; seed: string }[];
  allowCustom?: boolean; // default true
};
export type RegionTokenRole =
  | "background"
  | "foreground"
  | "muted"
  | "muted-foreground"
  | "card"
  | "card-foreground"
  | "primary"
  | "primary-foreground"
  | "accent"
  | "accent-foreground"
  | "border"
  | "ring";
export const REGION_TOKEN_ROLES: readonly RegionTokenRole[] = [
  "background",
  "foreground",
  "muted",
  "muted-foreground",
  "card",
  "card-foreground",
  "primary",
  "primary-foreground",
  "accent",
  "accent-foreground",
  "border",
  "ring",
];
export type RegionToken = `region-${ThemeTokenRegion}-${RegionTokenRole}`;
