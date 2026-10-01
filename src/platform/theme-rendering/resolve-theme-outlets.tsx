import { Fragment, Suspense, type ReactNode } from "react";
import type {
  OutletRenderContext,
  ResolvedThemeDefinition,
  ThemeOutletName,
  ThemeOutletNodes,
} from "@/contexts/themes/contracts/v8";
import { OutletErrorBoundary } from "@/components/outlet-error-boundary";
import { beginOperation, endOperation } from "@/observability";
import { PLUGIN_CONTRIBUTIONS } from "@/plugins/contributions";
import { getActivePluginKeys } from "@/platform/plugin-engine/get-active-plugin-keys";
import type { PluginContributions, PluginOutletContribution } from "@/platform/plugin-engine/plugin-contributions";
import { matchRoutePattern } from "@/platform/plugin-routing/match-route";
import { toPathSegments } from "./resolve-contextual-bar";

// Outlets de plugin no tema (spec v8 §7.4). Pipeline:
//  1. só plugins ATIVOS (getActivePluginKeys, cache() por request);
//  2. filtra por área (por caminho: /admin/** = admin; padrão de cada contribuição = só "public"),
//     por `match` (patterns da route-table, mesmo matcher das rotas de plugin) e pelos outlets que
//     o tema de fato renderiza (`theme.outletsRendered`; 7.x = só content.before/after);
//  3. ordena por (order ?? 100, pluginKey, key) — determinístico entre requests e deploys;
//  4. cada contribuição roda sob beginOperation('platform.theme-outlets.render'), com try/catch e
//     timeout de OUTLET_RENDER_TIMEOUT_MS (Promise.race → null);
//  5. cada nó vai embrulhado em <Suspense fallback={null}><OutletErrorBoundary> — o render é um
//     componente async, então um outlet lento não segura o layout (stream) e um que lança no
//     client vira null.
// `publicHomeShowcase` (contribuição antiga) é mapeado para `home.showcase` quando o plugin não
// declara um outlet próprio para esse nome (o outlet vence).

export const OUTLET_RENDER_TIMEOUT_MS = 1500;
const DEFAULT_OUTLET_ORDER = 100;
const DEFAULT_OUTLET_AREAS: readonly ("public" | "admin")[] = ["public"];

export type SelectedOutletContribution = { pluginKey: string; contribution: PluginOutletContribution };

// Contribuições de outlet de um plugin, incluindo o mapeamento legado publicHomeShowcase → home.showcase.
export function outletContributionsOf(contributions: PluginContributions): PluginOutletContribution[] {
  const declared = contributions.outlets ?? [];
  const showcase = contributions.publicHomeShowcase;
  if (!showcase || declared.some((outlet) => outlet.outlet === "home.showcase")) return declared;
  return [
    ...declared,
    { key: "public-home-showcase", outlet: "home.showcase", match: [""], render: async () => (await showcase()) ?? null },
  ];
}

function matchesAny(patterns: readonly string[], segments: string[]): boolean {
  return patterns.some((pattern) => {
    try {
      return matchRoutePattern(pattern.replace(/^\/+|\/+$/g, ""), segments) !== null;
    } catch {
      // :param com %XX inválido no caminho: não casa.
      return false;
    }
  });
}

function compareOutlets(left: SelectedOutletContribution, right: SelectedOutletContribution): number {
  const byOrder = (left.contribution.order ?? DEFAULT_OUTLET_ORDER) - (right.contribution.order ?? DEFAULT_OUTLET_ORDER);
  if (byOrder !== 0) return byOrder;
  if (left.pluginKey !== right.pluginKey) return left.pluginKey < right.pluginKey ? -1 : 1;
  if (left.contribution.key !== right.contribution.key) return left.contribution.key < right.contribution.key ? -1 : 1;
  return 0;
}

// Passos 1–3, puro (testável sem React/banco).
export function selectOutletContributions(
  registry: Readonly<Record<string, PluginContributions>>,
  activePluginKeys: ReadonlySet<string>,
  context: Pick<OutletRenderContext, "pathname" | "area">,
  outletsRendered: readonly ThemeOutletName[],
): Partial<Record<ThemeOutletName, SelectedOutletContribution[]>> {
  const segments = toPathSegments(context.pathname);
  const rendered = new Set(outletsRendered);
  const selected: SelectedOutletContribution[] = [];

  for (const [pluginKey, contributions] of Object.entries(registry)) {
    if (!activePluginKeys.has(pluginKey)) continue;
    for (const contribution of outletContributionsOf(contributions)) {
      if (!rendered.has(contribution.outlet)) continue;
      if (!(contribution.areas ?? DEFAULT_OUTLET_AREAS).includes(context.area)) continue;
      if (contribution.match && !matchesAny(contribution.match, segments)) continue;
      selected.push({ pluginKey, contribution });
    }
  }

  selected.sort(compareOutlets);
  const byOutlet: Partial<Record<ThemeOutletName, SelectedOutletContribution[]>> = {};
  for (const item of selected) {
    (byOutlet[item.contribution.outlet] ??= []).push(item);
  }
  return byOutlet;
}

// Passo 4: nunca lança, nunca passa do timeout.
export async function runOutletContribution(
  item: SelectedOutletContribution,
  context: OutletRenderContext,
  timeoutMs: number = OUTLET_RENDER_TIMEOUT_MS,
): Promise<ReactNode | null> {
  const handle = beginOperation({
    useCase: "platform.theme-outlets.render",
    actor: { id: `plugin:${item.pluginKey}`, type: "system" },
    kind: "read",
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });

  try {
    const result = await Promise.race([Promise.resolve().then(() => item.contribution.render(context)), timeout]);
    if (result === "timeout") {
      endOperation(handle, {
        success: false,
        error: {
          code: "platform.theme_outlets.timeout",
          message: `Outlet "${item.pluginKey}:${item.contribution.key}" (${item.contribution.outlet}) passou de ${timeoutMs} ms.`,
        },
      });
      return null;
    }
    endOperation(handle, { success: true });
    return result ?? null;
  } catch (error) {
    endOperation(handle, {
      success: false,
      error: {
        code: "platform.theme_outlets.render_failed",
        message: `Outlet "${item.pluginKey}:${item.contribution.key}" (${item.contribution.outlet}) falhou: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    });
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function OutletContributionNode({
  item,
  context,
  timeoutMs,
}: {
  item: SelectedOutletContribution;
  context: OutletRenderContext;
  timeoutMs: number;
}) {
  return <>{await runOutletContribution(item, context, timeoutMs)}</>;
}

// Passo 5: um nó por outlet com ≥ 1 contribuição.
export function buildOutletNodes(
  selected: Partial<Record<ThemeOutletName, SelectedOutletContribution[]>>,
  context: OutletRenderContext,
  timeoutMs: number = OUTLET_RENDER_TIMEOUT_MS,
): ThemeOutletNodes {
  const nodes: ThemeOutletNodes = {};
  for (const [outlet, items] of Object.entries(selected) as [ThemeOutletName, SelectedOutletContribution[]][]) {
    if (items.length === 0) continue;
    nodes[outlet] = (
      <>
        {items.map((item) => (
          <Fragment key={`${item.pluginKey}:${item.contribution.key}`}>
            <Suspense fallback={null}>
              <OutletErrorBoundary>
                <OutletContributionNode item={item} context={context} timeoutMs={timeoutMs} />
              </OutletErrorBoundary>
            </Suspense>
          </Fragment>
        ))}
      </>
    );
  }
  return nodes;
}

// Variante com registro/ativos injetados — fixtures e testes (src/plugins/_fixture-outlets, fora
// do PLUGIN_REGISTRY) usam esta; o render real usa resolveThemeOutlets.
export function resolveThemeOutletsFrom(
  registry: Readonly<Record<string, PluginContributions>>,
  activePluginKeys: ReadonlySet<string>,
  context: OutletRenderContext,
  theme: Pick<ResolvedThemeDefinition, "outletsRendered">,
  timeoutMs: number = OUTLET_RENDER_TIMEOUT_MS,
): ThemeOutletNodes {
  return buildOutletNodes(selectOutletContributions(registry, activePluginKeys, context, theme.outletsRendered), context, timeoutMs);
}

export async function resolveThemeOutlets(context: OutletRenderContext, theme: ResolvedThemeDefinition): Promise<ThemeOutletNodes> {
  const hasAnyOutlet = Object.values(PLUGIN_CONTRIBUTIONS).some((contributions) => outletContributionsOf(contributions).length > 0);
  if (!hasAnyOutlet) return {};
  return resolveThemeOutletsFrom(PLUGIN_CONTRIBUTIONS, await getActivePluginKeys(), context, theme);
}

export type OutletDiagnostic = {
  pluginKey: string;
  key: string;
  outlet: string;
  source: "contribution" | "manifest";
  reason: "not-rendered-by-theme" | "unknown-outlet";
};

// /admin/plugins: outlets declarados por plugins (contributions.ts e manifesto `outlets`) que o tema
// ativo não renderiza — a contribuição existe mas nunca aparece.
export function diagnoseOutlets(
  registry: Readonly<Record<string, PluginContributions>>,
  manifests: Readonly<Record<string, { outlets?: readonly { key: string; outlet: string }[] }>>,
  outletsRendered: readonly ThemeOutletName[],
  knownOutlets: readonly string[],
): OutletDiagnostic[] {
  const rendered = new Set<string>(outletsRendered);
  const known = new Set(knownOutlets);
  const seen = new Set<string>();
  const result: OutletDiagnostic[] = [];
  const push = (pluginKey: string, key: string, outlet: string, source: OutletDiagnostic["source"]) => {
    const id = `${pluginKey}:${key}:${outlet}`;
    if (seen.has(id)) return;
    seen.add(id);
    if (!known.has(outlet)) result.push({ pluginKey, key, outlet, source, reason: "unknown-outlet" });
    else if (!rendered.has(outlet)) result.push({ pluginKey, key, outlet, source, reason: "not-rendered-by-theme" });
  };
  for (const [pluginKey, contributions] of Object.entries(registry)) {
    for (const contribution of contributions.outlets ?? []) push(pluginKey, contribution.key, contribution.outlet, "contribution");
  }
  for (const [pluginKey, manifest] of Object.entries(manifests)) {
    for (const outlet of manifest.outlets ?? []) push(pluginKey, outlet.key, outlet.outlet, "manifest");
  }
  return result.sort((left, right) => (left.pluginKey + left.key < right.pluginKey + right.key ? -1 : 1));
}
