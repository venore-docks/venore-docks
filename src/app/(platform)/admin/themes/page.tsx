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
import { CustomColorPaletteForm } from "./_components/custom-color-palette-form";
import { HeaderBehaviorForm } from "./_components/header-behavior-form";
import { NavVisibilityForm } from "./_components/nav-visibility-form";
import type { PaletteColorTokens } from "@/contexts/themes";

// Tira de amostras da paleta (primary/accent/background/text que ela define). "Padrão do tema"
// não define nenhuma → um quadrinho com a primary do tema ativo, só pra não ficar em branco.
function PaletteSwatches({ tokens }: { tokens: PaletteColorTokens }) {
  const swatches = (["primary", "accent", "background", "foreground"] as const)
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
            Sobrescreve só a cor de destaque (primary/accent) do tema ativo, sem precisar trocar de tema, ou use
            &quot;Personalizada&quot; abaixo pra definir suas próprias cores de primary/secondary/background/text.
          </p>
        </div>
        <ul className="mt-4 space-y-3">
          {colorPaletteStates.palettes.map((palette) => (
            <li key={palette.id} className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <PaletteSwatches tokens={palette.light} />
                <span className="font-medium text-foreground">{palette.name}</span>
                {palette.isActive && <Badge variant="secondary">Ativa</Badge>}
              </div>
              {!palette.isActive && <ActivateColorPaletteButton paletteId={palette.id} />}
            </li>
          ))}
        </ul>

        {customPalette && <CustomColorPaletteForm light={customPalette.light} dark={customPalette.dark} />}
      </section>
    </div>
  );
}
