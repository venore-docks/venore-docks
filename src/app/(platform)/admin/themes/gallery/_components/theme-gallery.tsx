import Link from "next/link";
import type { ThemeServerStateKey } from "@/contexts/themes/contracts/v8";
import { Badge } from "@/components/ui/badge";
import { BlockRenderer } from "@/components/page-builder/block-renderer";
import { cn } from "@/lib/utils";
import { buildFixtureRenderModel, FixtureShell } from "@/platform/theme-gallery/fixture-model";
import { buildTemplateFixtures, fixturePageContent, STATE_FIXTURES, THEME_FIXTURE_SCENARIOS, type ThemeFixtureScenario } from "@/platform/theme-gallery/fixtures";
import { GALLERY_FRAME_WIDTHS, GALLERY_LOCALES, GALLERY_SCOPE, gallerySearch, type GalleryModel } from "@/platform/theme-gallery/gallery-model";
import type { ThemeStateView } from "@/platform/theme-engine/list-theme-states";
import { describeRegionContrastProblem } from "@/platform/theme-engine/contrast";
import { renderState } from "@/platform/theme-rendering/render-state";
import { renderTemplate } from "@/platform/theme-rendering/render-template";
import { resolveThemeStrings } from "@/platform/theme-rendering/resolve-theme-strings";
import { galleryNoopAction } from "../_actions/noop";
import { GalleryErrorState } from "./gallery-error-state";
import { GalleryFrame } from "./gallery-frame";

const FRAME_HEIGHT: Record<(typeof GALLERY_FRAME_WIDTHS)[number], number> = { 390: 844, 1280: 800 };
const ACTIONS = { onSignOut: galleryNoopAction, onToggleNavMode: galleryNoopAction, onToggleCollapsed: galleryNoopAction };
const SERVER_STATES: ThemeServerStateKey[] = ["loading", "empty", "forbidden", "notFound", "maintenance"];
// Regiões: todo cenário dos fixtures menos os que já aparecem em "Layouts".
const REGION_SCENARIOS = THEME_FIXTURE_SCENARIOS.filter((scenario) => scenario.name !== "logged-in" && scenario.name !== "rail-layout");

function SectionHeading({ id, title, description }: { id: string; title: string; description: string }) {
  return (
    <header className="space-y-1">
      <h2 id={id} className="text-base font-semibold text-foreground">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </header>
  );
}

function Pill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-md border px-3 py-1 text-xs ui-motion-base outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-ring bg-accent/14 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

export function ThemeGallery({ gallery, themes }: { gallery: GalleryModel; themes: ThemeStateView[] }) {
  const { theme, selection } = gallery;
  const href = (patch: Parameters<typeof gallerySearch>[1]) => `/admin/themes/gallery${gallerySearch(selection, patch)}`;
  const frame = { rootAttributes: gallery.rootAttributes, rootClassName: gallery.rootClassName };
  const withLocale = (scenario: ThemeFixtureScenario): ThemeFixtureScenario =>
    scenario.name === "rtl-ar" ? scenario : { ...scenario, locale: selection.locale, dir: selection.dir };
  const shell = (scenario: ThemeFixtureScenario) => {
    const model = buildFixtureRenderModel(theme, withLocale(scenario), { scope: GALLERY_SCOPE, actions: ACTIONS });
    return <FixtureShell model={model}>{fixturePageContent()}</FixtureShell>;
  };
  const strings = resolveThemeStrings(theme, selection.locale);
  const common = { strings, locale: selection.locale, dir: selection.dir, options: {}, area: "public" as const };
  const templates = buildTemplateFixtures(common);
  const presets = theme.legacyShell ? [{ name: "Shell 7.x do pacote", scenario: "logged-in" }] : [
    { name: "Preset topbar", scenario: "logged-in" },
    { name: "Preset rail", scenario: "rail-layout" },
  ];
  const baseScenario = (name: string) => THEME_FIXTURE_SCENARIOS.find((scenario) => scenario.name === name)!;
  const presetScenario = (name: string): ThemeFixtureScenario => {
    const scenario = baseScenario(name);
    // O preset topbar é pedido explicitamente: um tema v8 cujo padrão é rail também mostra o topbar.
    return name === "logged-in" && !theme.legacyShell ? { ...scenario, arrangement: { layoutPreset: "topbar" } } : scenario;
  };

  return (
    <div className="space-y-10">
      {/* CSS de runtime do tema da galeria — paleta (W1), opções (W2) e fontes (W8) com escopo
          [data-gallery-root]: não muda nada no admin em volta. */}
      {gallery.scopedCss ? <style data-gallery-css="" dangerouslySetInnerHTML={{ __html: gallery.scopedCss }} /> : null}

      <section aria-label="Escolha do tema" className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {themes.map((state) => (
            <Pill key={state.manifest.key} href={href({ themeKey: state.manifest.key })} active={state.manifest.key === theme.key}>
              {state.manifest.name}
              {state.isActive ? " · ativo" : ""}
              {!state.enabled ? " · desabilitado" : ""}
            </Pill>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Modo:</span>
          {theme.manifest.colorModes.map((mode) => (
            <Pill key={mode} href={href({ mode })} active={selection.mode === mode}>
              {mode === "light" ? "claro" : "escuro"}
            </Pill>
          ))}
          <span className="ms-2">Idioma:</span>
          {GALLERY_LOCALES.map((locale) => (
            <Pill key={locale} href={href({ locale, dir: locale.startsWith("ar") ? "rtl" : "ltr" })} active={selection.locale === locale}>
              {locale}
            </Pill>
          ))}
          <span className="ms-2">Direção:</span>
          {(["ltr", "rtl"] as const).map((dir) => (
            <Pill key={dir} href={href({ dir })} active={selection.dir === dir}>
              {dir}
            </Pill>
          ))}
        </div>
      </section>

      <section aria-labelledby="gallery-summary" className="space-y-2 rounded-panel border border-border bg-card ui-panel-padding-roomy">
        <h2 id="gallery-summary" className="text-base font-semibold text-foreground">
          {theme.manifest.name} <span className="text-sm font-normal text-muted-foreground">({theme.key})</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">contrato {theme.contract}</Badge>
          <Badge variant="outline">v{theme.manifest.version}</Badge>
          {theme.chain.length > 1 ? <Badge variant="outline">herda de {theme.chain.slice(1).join(" → ")}</Badge> : null}
          <Badge variant="outline">mobile: {theme.responsive.mobileNav}</Badge>
          <Badge variant="outline">modos: {theme.manifest.colorModes.join(", ")}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Renderizado com os fixtures do CI, sem ativar o tema. O site e este admin continuam no tema ativo.
        </p>
        {gallery.fallback ? (
          <p role="status" className="text-sm text-warning">
            {gallery.fallback.reason === "disabled"
              ? `O tema “${gallery.fallback.requestedKey}” está desabilitado — a galeria mostra o fallback (venore-slime), como o site faria.`
              : `O tema pedido caiu no fallback (${gallery.fallback.reason}).`}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="gallery-layouts" className="space-y-4">
        <SectionHeading id="gallery-layouts" title="Layouts" description="Cada preset de layout em molduras de 390 px e 1280 px (visitante logado, conteúdo de exemplo)." />
        {presets.map((preset) => (
          <div key={preset.name} className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">{preset.name}</h3>
            <div className="flex flex-col gap-4">
              {GALLERY_FRAME_WIDTHS.map((width) => (
                <GalleryFrame key={width} title={preset.name} width={width} height={FRAME_HEIGHT[width]} {...frame}>
                  {shell(presetScenario(preset.scenario))}
                </GalleryFrame>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section aria-labelledby="gallery-regions" className="space-y-4">
        <SectionHeading
          id="gallery-regions"
          title="Regiões"
          description="Header, rail, rodapé, trilha, menu do usuário, barra contextual e navegação mobile nos cenários do CI."
        />
        {REGION_SCENARIOS.filter((scenario) => !(theme.legacyShell && scenario.arrangement)).map((scenario) => (
          <div key={scenario.name} className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">{scenario.label}</h3>
            <div className="flex flex-col gap-4">
              {GALLERY_FRAME_WIDTHS.map((width) => (
                <GalleryFrame key={width} title={scenario.label} width={width} height={FRAME_HEIGHT[width]} {...frame}>
                  {shell(scenario)}
                </GalleryFrame>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section aria-labelledby="gallery-templates" className="space-y-4">
        <SectionHeading id="gallery-templates" title="Templates" description="Cada template de página e cada variante que o tema registra." />
        {gallery.templates.flatMap(({ key, variants }) =>
          variants.map((variant) => (
            <GalleryFrame key={`${key}:${variant}`} title={`${key} · ${variant}`} width={null} height={null} {...frame}>
              <main className="mx-auto w-full max-w-6xl p-6">{renderTemplate(theme, key, templates[key], { variant })}</main>
            </GalleryFrame>
          )),
        )}
      </section>

      <section aria-labelledby="gallery-states" className="space-y-4">
        <SectionHeading id="gallery-states" title="Estados" description="Carregando, vazio, proibido, não encontrado, manutenção e erro (client)." />
        <GalleryFrame title="Estados" width={null} height={null} {...frame}>
          <div className="grid gap-6 p-6">
            {SERVER_STATES.map((kind) => (
              <div key={kind} className="space-y-2 rounded-xl border border-border p-4">
                <p className="text-xs uppercase tracking-caps text-muted-foreground">{kind}</p>
                {renderState(theme, kind, { ...common, ...STATE_FIXTURES[kind] })}
              </div>
            ))}
            <div className="space-y-2 rounded-xl border border-border p-4">
              <p className="text-xs uppercase tracking-caps text-muted-foreground">error</p>
              <GalleryErrorState themeKey={theme.key} strings={strings} />
            </div>
          </div>
        </GalleryFrame>
      </section>

      <section aria-labelledby="gallery-blocks" className="space-y-4">
        <SectionHeading
          id="gallery-blocks"
          title="Blocos"
          description="Todo bloco do core com o dado padrão, cada variante de apresentação do tema e cada estilo de seção."
        />
        <GalleryFrame title="Blocos do page builder" width={null} height={null} {...frame}>
          <div className="mx-auto grid w-full max-w-6xl gap-8 p-6">
            {gallery.blocks.map((sample) => (
              <div key={sample.id} className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {sample.label}
                  {sample.variant ? ` · variante ${sample.variant}` : ""}
                </p>
                <BlockRenderer blocks={sample.blocks} mode="published" themeKey={theme.key} />
              </div>
            ))}
          </div>
        </GalleryFrame>
      </section>

      <section aria-labelledby="gallery-tokens" className="space-y-4">
        <SectionHeading
          id="gallery-tokens"
          title="Tokens e contraste"
          description="Contraste por região (texto ≥ 4,5; ring e accent ≥ 3), claro e escuro, com a paleta padrão do tema."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {gallery.contrast.map(({ region, mode, problems }) => (
            <div key={`${region}-${mode}`} className="space-y-1 rounded-xl border border-border bg-card p-3">
              <p className="text-xs font-medium text-foreground">
                {region} · {mode === "light" ? "claro" : "escuro"}
              </p>
              {problems.length === 0 ? (
                <Badge variant="secondary">contraste ok</Badge>
              ) : (
                problems.map((problem) => (
                  <Badge key={problem.pair} variant="destructive" title={describeRegionContrastProblem(problem)}>
                    {problem.pair} {problem.ratio.toFixed(2)}:1
                  </Badge>
                ))
              )}
            </div>
          ))}
        </div>
        <GalleryFrame title="Tokens" width={null} height={null} {...frame}>
          <div className="overflow-x-auto p-6">
            <table className="w-full text-start text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th scope="col" className="py-1 pe-3 text-start font-medium">token</th>
                  <th scope="col" className="py-1 pe-3 text-start font-medium">amostra ({selection.mode === "light" ? "claro" : "escuro"})</th>
                  <th scope="col" className="py-1 pe-3 text-start font-medium">claro</th>
                  <th scope="col" className="py-1 text-start font-medium">escuro</th>
                </tr>
              </thead>
              <tbody className="text-foreground">
                {gallery.tokens.map((token) => (
                  <tr key={token.name} className="border-t border-border">
                    <td className="py-1 pe-3 font-mono">--{token.name}</td>
                    <td className="py-1 pe-3">
                      <span className="inline-block size-5 rounded-md border border-border" style={{ background: `var(--${token.name})` }} />
                    </td>
                    <td className="py-1 pe-3 font-mono text-muted-foreground">{token.light ?? "—"}</td>
                    <td className="py-1 font-mono text-muted-foreground">{token.dark ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GalleryFrame>
      </section>

      <section aria-labelledby="gallery-options" className="space-y-4">
        <SectionHeading id="gallery-options" title="Opções" description="Opções declaradas pelo tema e seus valores padrão." />
        {gallery.options.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este tema não declara opções.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-start text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 text-start font-medium">chave</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">rótulo</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">tipo</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">padrão</th>
                </tr>
              </thead>
              <tbody>
                {gallery.options.map((option) => (
                  <tr key={option.key} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs text-foreground">{option.key}</td>
                    <td className="px-3 py-2 text-foreground">{option.label}</td>
                    <td className="px-3 py-2 text-muted-foreground">{option.type}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{option.defaultValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
