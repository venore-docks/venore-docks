import { Badge } from "@/components/ui/badge";
import { listColorPaletteStates } from "@/platform/theme-engine/list-color-palette-states";
import { CUSTOM_COLOR_PALETTE_ID } from "@/platform/theme-engine/custom-color-palette";
import type { PaletteColorTokens } from "@/contexts/themes";
import { isValidHexColor, oklchToHex, parseOklchNumeric } from "@/platform/theme-engine/oklch-color";
import { buildFullPaletteFromSeed } from "@/platform/theme-engine/full-palette-generator";
import type { ColorPaletteStateView } from "@/platform/theme-engine/list-color-palette-states";
import { ActivateColorPaletteButton } from "../_components/activate-color-palette-button";
import { ApplyPresetPaletteButton } from "../_components/apply-preset-palette-button";
import { CustomColorPaletteForm } from "../_components/custom-color-palette-form";
import { BrandColorPaletteForm } from "../_components/brand-color-palette-form";

// Seção de paleta de /admin/themes (movida de page.tsx sem mudança de markup — spec v8 §9).
// Dono: W1.

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
// gera (não só primary/accent), roda a mesma geração aqui, só pra preview, sem salvar nada.
function previewTokens(palette: ColorPaletteStateView): PaletteColorTokens {
  if (palette.id === "default" || palette.id === CUSTOM_COLOR_PALETTE_ID) return palette.light;
  const seed = palette.light.primary ? parseOklchNumeric(palette.light.primary) : null;
  return seed ? buildFullPaletteFromSeed(seed).light : palette.light;
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
  const colorPaletteStates = await listColorPaletteStates();
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

      <ul className="mt-4 space-y-3">
        {colorPaletteStates.palettes.map((palette) => {
          const isPreset = palette.id !== "default" && palette.id !== CUSTOM_COLOR_PALETTE_ID;
          return (
            <li key={palette.id} className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <PaletteSwatches tokens={previewTokens(palette)} />
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
