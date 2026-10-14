import { FONT_IDS, type FontId, type FontRole } from "@/contexts/themes/contracts/v8";

// Metadado das fontes curadas (spec §2.9/§7.6), sem next/font — seguro em client component (painel
// Fontes) e em teste. As chamadas next/font de verdade ficam em ./registry.ts.
export type FontCatalogEntry = {
  id: FontId;
  label: string;
  // Variável CSS que a classe `.variable` do next/font declara. Geist mantém os nomes de antes da
  // v8 (fonts.css usa --font-geist-* como fallback).
  cssVariable: `--font-${string}`;
  category: "sans" | "serif" | "mono";
  // Roles em que a fonte faz sentido no seletor (o tema ainda pode declarar outra coisa).
  roles: readonly FontRole[];
  // Script não latino que a família cobre (fontes para locale RTL).
  script?: "arabic" | "hebrew";
};

export const FONT_CATALOG: Readonly<Record<FontId, FontCatalogEntry>> = {
  geist: { id: "geist", label: "Geist", cssVariable: "--font-geist-sans", category: "sans", roles: ["sans", "display"] },
  "geist-mono": { id: "geist-mono", label: "Geist Mono", cssVariable: "--font-geist-mono", category: "mono", roles: ["mono"] },
  inter: { id: "inter", label: "Inter", cssVariable: "--font-inter", category: "sans", roles: ["sans", "display"] },
  manrope: { id: "manrope", label: "Manrope", cssVariable: "--font-manrope", category: "sans", roles: ["sans", "display"] },
  "space-grotesk": { id: "space-grotesk", label: "Space Grotesk", cssVariable: "--font-space-grotesk", category: "sans", roles: ["sans", "display"] },
  fraunces: { id: "fraunces", label: "Fraunces", cssVariable: "--font-fraunces", category: "serif", roles: ["display", "sans"] },
  "playfair-display": { id: "playfair-display", label: "Playfair Display", cssVariable: "--font-playfair-display", category: "serif", roles: ["display"] },
  "source-serif-4": { id: "source-serif-4", label: "Source Serif 4", cssVariable: "--font-source-serif-4", category: "serif", roles: ["sans", "display"] },
  "jetbrains-mono": { id: "jetbrains-mono", label: "JetBrains Mono", cssVariable: "--font-jetbrains-mono", category: "mono", roles: ["mono"] },
  "ibm-plex-mono": { id: "ibm-plex-mono", label: "IBM Plex Mono", cssVariable: "--font-ibm-plex-mono", category: "mono", roles: ["mono"] },
  "noto-sans-arabic": { id: "noto-sans-arabic", label: "Noto Sans Arabic", cssVariable: "--font-noto-sans-arabic", category: "sans", roles: ["sans", "display"], script: "arabic" },
  "noto-sans-hebrew": { id: "noto-sans-hebrew", label: "Noto Sans Hebrew", cssVariable: "--font-noto-sans-hebrew", category: "sans", roles: ["sans", "display"], script: "hebrew" },
};

// Padrão de cada papel quando nada (manifesto, opção, config) escolhe: o que o site usa hoje.
export const DEFAULT_FONTS: Readonly<Record<FontRole, FontId>> = { sans: "geist", display: "geist", mono: "geist-mono" };

const FONT_ID_SET: ReadonlySet<string> = new Set(FONT_IDS);
export function isFontId(value: unknown): value is FontId {
  return typeof value === "string" && FONT_ID_SET.has(value);
}

// Ids oferecidos para um papel: `choices` do manifesto quando declarado (filtrado à whitelist),
// senão toda fonte do catálogo que serve ao papel.
export function fontOptionsForRole(role: FontRole, choices: Partial<Record<FontRole, readonly FontId[]>> | undefined): FontId[] {
  const declared = choices?.[role];
  if (declared && declared.length > 0) return declared.filter(isFontId);
  return FONT_IDS.filter((id) => FONT_CATALOG[id].roles.includes(role));
}
