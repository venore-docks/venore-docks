import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getSettingsPageData } from "@/platform/admin-shell/get-settings-page-data";
import { listThemeStates } from "@/platform/theme-engine/list-theme-states";
import { listColorPaletteStates } from "@/platform/theme-engine/list-color-palette-states";
import { CUSTOM_COLOR_PALETTE_ID } from "@/platform/theme-engine/custom-color-palette";
import { getHeaderBehavior } from "@/platform/header-behavior/get-header-behavior";
import { getNavVisibility } from "@/platform/nav-visibility/get-nav-visibility";
import { ActivateThemeButton } from "./_components/activate-theme-button";
import { ToggleThemeControl } from "./_components/toggle-theme-control";
import { ThemeUpdatePanel } from "./_components/theme-update-panel";
import { ActivateColorPaletteButton } from "./_components/activate-color-palette-button";
import { ApplyPresetPaletteButton } from "./_components/apply-preset-palette-button";
import { CustomColorPaletteForm } from "./_components/custom-color-palette-form";
import { BrandColorPaletteForm } from "./_components/brand-color-palette-form";
import { HeaderBehaviorForm } from "./_components/header-behavior-form";
import { NavVisibilityForm } from "./_components/nav-visibility-form";
import type { PaletteColorTokens } from "@/contexts/themes";
import { isValidHexColor, oklchToHex, parseOklchNumeric } from "@/platform/theme-engine/oklch-color";
import { buildFullPaletteFromSeed } from "@/platform/theme-engine/full-palette-generator";
import type { ColorPaletteStateView } from "@/platform/theme-engine/list-color-palette-states";

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

export default async function ThemesAdminPage() {
  const gate = await getSettingsPageData();

  if (!gate.granted) {
    return (
      <div className="rounded-panel border border-border bg-card ui-panel-padding-roomy text-center">
        <h1 className="text-lg font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Você não tem permissão para gerenciar temas.</p>
      </div>
    );
  }

  const [themes, colorPaletteStates, headerBehavior, navVisibility] = await Promise.all([
    listThemeStates(),
    listColorPaletteStates(),
    getHeaderBehavior(),
    getNavVisibility(),
  ]);
  const customPalette = colorPaletteStates.palettes.find((palette) => palette.id === CUSTOM_COLOR_PALETTE_ID);
  const firstCatalogPreset = colorPaletteStates.palettes.find(
    (palette) => palette.id !== "default" && palette.id !== CUSTOM_COLOR_PALETTE_ID,
  );
  const brandHex = resolveBrandHex(customPalette?.light.primary, firstCatalogPreset?.light.primary);
  const activeTheme = themes.find((theme) => theme.isActive);
  const activeThemeSupportsHeaderBehavior = activeTheme?.manifest.capabilities?.headerBehavior ?? false;
  // Mais sensível que settings.manage (que já libera esta página inteira): "Atualizar" comita
  // no repo do site e aciona um deploy de verdade. Fora de ADMIN_BASE_PERMISSION_KEYS de
  // propósito — só aparece pra quem recebeu a permission explicitamente (docs/venore-docks.md,
  // mesmo padrão de media.purge).
  const canUpdateThemes = gate.actor.isSuperadmin || gate.actor.permissions.includes("platform.extensions.update");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Aparência</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha o tema visual usado no site, ajuste o comportamento do header e as cores, entre os temas
          instalados e habilitados. <Link href="/admin/themes/preview" className="text-primary underline">Ver amostra dos temas</Link>.
        </p>
      </div>

      <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
        <ul className="space-y-3">
          {themes.map(({ manifest, enabled, isActive, canDisable, disableBlockedReason }) => (
            <li key={manifest.key} className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{manifest.name}</span>
                  {isActive && <Badge variant="secondary">Ativo</Badge>}
                </div>
                {/* manifest.version é a mesma fonte que getThemeUpdateStatus já trata como
                    "versão instalada" pra comparar com a última tag do GitHub (theme-update-
                    status.ts) — não lê package.json de novo aqui, só reflete o que o registro já
                    carrega. */}
                <span className="text-xs text-muted-foreground/72">v{manifest.version}</span>
              </div>
              <div className="flex items-center gap-2">
                {canUpdateThemes && <ThemeUpdatePanel themeKey={manifest.key} themeName={manifest.name} />}
                {!isActive && enabled && <ActivateThemeButton themeKey={manifest.key} />}
                <ToggleThemeControl
                  themeKey={manifest.key}
                  themeName={manifest.name}
                  enabled={enabled}
                  canDisable={canDisable}
                  disableBlockedReason={disableBlockedReason}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {activeThemeSupportsHeaderBehavior && <HeaderBehaviorForm behavior={headerBehavior} />}

      <NavVisibilityForm visibility={navVisibility} />

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
    </div>
  );
}
