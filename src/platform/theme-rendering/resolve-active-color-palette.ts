import { cache } from "react";
import { getActiveColorPalette, type ColorPalette, type PaletteColorTokens } from "@/contexts/themes";
import type { ResolvedThemeDefinition, ThemePaletteChoice } from "@/contexts/themes/contracts/v8";
import { resolveActiveTheme } from "./resolve-active-theme";
import { CUSTOM_COLOR_PALETTE_ID, getCustomColorPalette } from "@/platform/theme-engine/custom-color-palette";

// T3 (docs/implementation-roadmap.md — Fase 5, fundação): paleta ativa resolvida pra runtime —
// null quando o paletteId salvo é "default" ou não existe (mais) no catálogo do tema ativo (ex:
// tema trocado depois de escolher uma paleta específica do tema anterior), caso em que o
// theme.css do tema ativo simplesmente vale como está, sem override nenhum. cache() pelo mesmo
// motivo de resolveActiveTheme/resolveBrandAesthetics: usado tanto no root layout (aplica o
// override) quanto potencialmente em telas admin no mesmo request.
export const resolveActiveColorPalette = cache(async (): Promise<ColorPalette | null> => {
  const [{ colorPalettes, manifest }, activePaletteResult] = await Promise.all([
    resolveActiveTheme(),
    getActiveColorPalette(),
  ]);
  if (!activePaletteResult.success) return null;

  const paletteId = activePaletteResult.data.paletteId;
  if (paletteId === "default") return null;
  if (paletteId === CUSTOM_COLOR_PALETTE_ID) return getCustomColorPalette(manifest.key);

  return colorPalettes.find((palette) => palette.id === paletteId) ?? null;
});

const TOKEN_NAME_PREFIX = "--";

function buildDeclarationBlock(tokens: PaletteColorTokens): string {
  return Object.entries(tokens)
    .map(([token, value]) => `${TOKEN_NAME_PREFIX}${token}: ${value};`)
    .join(" ");
}

// Especificidade (0,1,1) — `html[data-theme="x"]` — deliberadamente maior que o seletor de
// theme.css (`[data-theme="x"]`, especificidade 0,1,0): garante que o override vence na cascata
// sem depender de ordem de inserção no documento nem de `!important` (o `<style>` pode acabar
// renderizado em qualquer posição do body — ver comentário em layout.tsx). Mesmo raciocínio pro
// par `.dark` (0,2,1 > 0,2,0).
export function buildColorPaletteOverrideCss(themeKey: string, palette: ColorPalette): string {
  const blocks: string[] = [];
  if (Object.keys(palette.light).length > 0) {
    blocks.push(`html[data-theme="${themeKey}"] { ${buildDeclarationBlock(palette.light)} }`);
  }
  if (Object.keys(palette.dark).length > 0) {
    blocks.push(`html[data-theme="${themeKey}"].dark { ${buildDeclarationBlock(palette.dark)} }`);
  }
  return blocks.join("\n");
}

// ── v8 (spec §6 passo 9) ─────────────────────────────────────────────────────────────────────
// Escolha de paleta do documento de config → CSS de override. Dono: W1 (gerador por seed, tokens
// de região, `scope` da galeria); a Fase F só embrulha buildColorPaletteOverrideCss acima, então
// o CSS sai idêntico ao de antes para default/preset/custom.
const SAFE_TOKEN_NAME = /^[a-z][a-z0-9-]{0,63}$/;
const SAFE_COLOR_VALUE = /^(?:#[0-9a-f]{3}|#[0-9a-f]{6}|oklch\([0-9.%\s/]+\))$/i;

function safeTokens(tokens: Record<string, string>): PaletteColorTokens {
  return Object.fromEntries(
    Object.entries(tokens).filter(([token, value]) => SAFE_TOKEN_NAME.test(token) && SAFE_COLOR_VALUE.test(value)),
  ) as PaletteColorTokens;
}

export function paletteFromChoice(colorPalettes: readonly ColorPalette[], choice: ThemePaletteChoice | undefined): ColorPalette | null {
  if (!choice || choice.mode === "default") return null;
  if (choice.mode === "preset") return colorPalettes.find((palette) => palette.id === choice.presetId) ?? null;
  const tokens = choice.mode === "seed" ? choice.generated : choice;
  return { id: CUSTOM_COLOR_PALETTE_ID, name: "Personalizada", light: safeTokens(tokens.light), dark: safeTokens(tokens.dark) };
}

export function buildPaletteCss(
  theme: Pick<ResolvedThemeDefinition, "key" | "colorPalettes">,
  choice: ThemePaletteChoice | undefined,
  context: { scope?: string } = {},
): string {
  const palette = paletteFromChoice(theme.colorPalettes, choice);
  if (!palette) return "";
  const css = buildColorPaletteOverrideCss(theme.key, palette);
  if (!context.scope) return css;
  return css.split(`html[data-theme="${theme.key}"]`).join(context.scope);
}
