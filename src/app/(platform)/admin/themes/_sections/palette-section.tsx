import { Badge } from "@/components/ui/badge";
import { listColorPaletteStates } from "@/platform/theme-engine/list-color-palette-states";
import { CUSTOM_COLOR_PALETTE_ID } from "@/platform/theme-engine/custom-color-palette";
import type { PaletteColorTokens } from "@/contexts/themes";
import { isValidHexColor, oklchToHex, parseOklchNumeric } from "@/platform/theme-engine/oklch-color";
import { generateThemePalette } from "@/platform/theme-engine/palette/generate-theme-palette";
import { checkActivePaletteContrast } from "@/platform/theme-engine/palette/palette-admin";
import { getThemeTokenValues } from "@/platform/theme-engine/token-values";
import { resolveActiveColorPalette } from "@/platform/theme-rendering/resolve-active-color-palette";
import { resolveActiveTheme } from "@/platform/theme-rendering/resolve-active-theme";
import { resolveThemeDefinition } from "@/platform/theme-rendering/resolve-theme-definition";
import type { ThemePaletteRules } from "@/contexts/themes/contracts/v8";
import type { ColorPaletteStateView } from "@/platform/theme-engine/list-color-palette-states";
import { ActivateColorPaletteButton } from "../_components/activate-color-palette-button";
import { ApplyPresetPaletteButton } from "../_components/apply-preset-palette-button";
import { CustomColorPaletteForm } from "../_components/custom-color-palette-form";
import { BrandColorPaletteForm } from "../_components/brand-color-palette-form";
import { PaletteContrastSummary } from "../_components/palette-contrast-summary";

// Seção de paleta de /admin/themes (spec v8 §9). Dono: W1. Fluxo legado (theme.activePaletteId /
// theme.customColorPalette.<tema>) com o gerador unificado e o resumo de contraste por região da
// paleta ativa; o rascunho v8 da paleta mora no painel de /admin/themes/customize.

const BRAND_HEX_FALLBACK = "#000000";

// Prefill do picker de "cor de marca": prefere o `primary` já salvo na paleta personalizada (já
// vem em hex, formato gravável) — senão deriva do `primary` do 1º preset do catálogo do tema ativo
// (vem em oklch, precisa converter pra o picker nativo entender). Nunca deixa o campo vazio/preto
// sem necessidade real.
function resolveBrandHex(customPrimary: string | undefined, catalogPrimary: string | undefined): string {
  if (customPrimary && isValidHexColor(customPrimary)) return customPrimary;
  if (catalogPrimary) {
    const parsed = parseOklchNumeric(catalogPrimary);
    if (parsed) return oklchToHex(parsed.l, parsed.c, parsed.h);
  }
  return BRAND_HEX_FALLBACK;
}

// Presets (Espaço/Ametista/Âmbar/Rubro etc.) só têm 5 tokens no catálogo estático do tema (ver
// applyPresetPaletteAction) — pra amostra refletir a paleta INTEIRA que clicar em "Usar" de fato
// gera (não só primary/accent), roda a mesma geração aqui (gerador unificado, com as regras de
// paleta do tema — v8 §7.14), só pra preview, sem salvar nada.
function previewTokens(palette: ColorPaletteStateView, themeKey: string, rules: ThemePaletteRules): PaletteColorTokens {
  if (palette.id === "default" || palette.id === CUSTOM_COLOR_PALETTE_ID) return palette.light;
  const seed = palette.light.primary ? parseOklchNumeric(palette.light.primary) : null;
  return seed ? generateThemePalette({ seed, rules, base: getThemeTokenValues(themeKey) }).light : palette.light;
}

// Tira de amostras da paleta (primary/accent/sidebar/background que ela define — sidebar entrou
// aqui de propósito: é o token que motivou ampliar o vocabulário, então a amostra já mostra que
// ele muda). "Padrão do tema" não define nenhuma → um quadrinho com a primary do tema ativo, só
// pra não ficar em branco.
function PaletteSwatches({ tokens }: { tokens: PaletteColorTokens }) {
  const swatches = (["primary", "accent", "sidebar-bg-start", "background"] as const)
    .map((token) => tokens[token])
    .filter((value): value is string => Boolean(value));
  const shown = swatches.length > 0 ? swatches : ["var(--primary)"];
  return (
    <span aria-hidden className="flex shrink-0 overflow-hidden rounded-md border border-border">
      {shown.map((color, index) => (
        <span key={index} className="size-4" style={{ background: color }} />
      ))}
    </span>
  );
}

export async function PaletteSection() {
  const [colorPaletteStates, activePalette, { manifest }] = await Promise.all([
    listColorPaletteStates(),
    resolveActiveColorPalette(),
    resolveActiveTheme(),
  ]);
  // Regras de paleta do tema (com herança, W9) e contraste por região da paleta ativa (W1).
  const { theme } = resolveThemeDefinition(manifest.key);
  const contrastProblems = checkActivePaletteContrast(theme, activePalette);
  const customPalette = colorPaletteStates.palettes.find((palette) => palette.id === CUSTOM_COLOR_PALETTE_ID);
  const firstCatalogPreset = colorPaletteStates.palettes.find(
    (palette) => palette.id !== "default" && palette.id !== CUSTOM_COLOR_PALETTE_ID,
  );
  const brandHex = resolveBrandHex(customPalette?.light.primary, firstCatalogPreset?.light.primary);

  return (
    <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Paleta de cor — {colorPaletteStates.themeName}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Escolha 1 cor de marca abaixo pra gerar a paleta inteira do tema ativo — fundo, texto, sidebar, header,
          cards e um destaque na cor complementar, tudo de uma vez (o mesmo efeito de criar um tema novo só pra
          trocar a cor, sem precisar de um pacote novo) — ou escolha um dos presets prontos na lista. Quem quiser
          ajuste fino token a token encontra em &quot;Avançado&quot;.
        </p>
      </div>

      <BrandColorPaletteForm hex={brandHex} />
      <PaletteContrastSummary problems={contrastProblems} />

      <ul className="mt-4 space-y-3">
        {colorPaletteStates.palettes.map((palette) => {
          const isPreset = palette.id !== "default" && palette.id !== CUSTOM_COLOR_PALETTE_ID;
          return (
            <li key={palette.id} className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <PaletteSwatches tokens={previewTokens(palette, theme.key, theme.palette)} />
                <span className="font-medium text-foreground">{palette.name}</span>
                {palette.isActive && <Badge variant="secondary">Ativa</Badge>}
              </div>
              {!palette.isActive &&
                (isPreset ? (
                  <ApplyPresetPaletteButton paletteId={palette.id} />
                ) : (
                  <ActivateColorPaletteButton paletteId={palette.id} />
                ))}
            </li>
          );
        })}
      </ul>

      {customPalette && <CustomColorPaletteForm light={customPalette.light} dark={customPalette.dark} />}
    </section>
  );
}
