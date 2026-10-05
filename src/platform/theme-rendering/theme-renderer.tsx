import { type ComponentType, type ReactNode } from "react";
import type { MainNavItem } from "@/contexts/themes/contracts/types";
import type {
  HeaderRegionProps,
  RailRegionProps,
  RegionCommon,
  ThemeLayoutPreset,
  ThemeMobileNavMode,
  ThemeOutletName,
  ThemeRegionKey,
  ThemeRenderModel,
} from "@/contexts/themes/contracts/v8";
import { KIT_LAYOUTS, SkipLink, type KitLayoutProps } from "@/theme-sdk/kit/layouts";
import { CoreJsonLd } from "@/theme-sdk/kit/json-ld";
import { ThemeOutlet } from "@/theme-sdk/kit/outlet";
import { RegionBoundary } from "@/theme-sdk/kit/region-boundary";
import {
  KitBreadcrumbs,
  KitContextualBar,
  KitFooter,
  KitHeader,
  KitMobileNav,
  KitRail,
  KitUserMenu,
} from "@/theme-sdk/kit/regions";
import { KitNavModeSwitch } from "@/theme-sdk/kit/regions/rail/rail";
import { MobileNavToggleButton } from "@/theme-sdk/kit/regions/site-header/mobile-nav-toggle-button";

// Renderer v8 (spec §6). Dono: W3 (layouts/regiões do kit).
// Cada região é a do kit, ou o override do tema embrulhado em RegionBoundary (client) com a região
// do kit como fallback — um override que lança nunca derruba a página.
//
// Sem <Suspense> em volta do override: com ele, o React "terceiriza" (outlining) a fronteira quando
// o HTML passa do progressiveChunkSize (~12,8 KB), e o documento sai com a região do kit visível e o
// override escondido, trocados por script — robô de busca e visitante sem JS viam as duas. No SSR,
// o override de servidor (função comum, o caso dos temas) é chamado aqui dentro de try/catch: se
// lançar, sai a região do kit. Componente client (referência "use client") e componente async não
// podem ser chamados assim e são renderizados direto — o RegionBoundary cobre o erro no client, e o
// harness SSR do theme:check garante que o override renderiza no servidor.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = any;

const CLIENT_REFERENCE = Symbol.for("react.client.reference");

function isPromise(value: unknown): value is Promise<unknown> {
  return typeof value === "object" && value !== null && typeof (value as Promise<unknown>).then === "function";
}

function renderOverride(Override: ComponentType<AnyProps>, props: AnyProps, kitNode: ReactNode): ReactNode {
  const element = <Override {...props} />;
  const isClientReference = (Override as unknown as { $$typeof?: symbol }).$$typeof === CLIENT_REFERENCE;
  const isClass = Boolean((Override as { prototype?: { isReactComponent?: unknown } }).prototype?.isReactComponent);
  if (typeof Override !== "function" || isClientReference || isClass) return element;
  try {
    const output = (Override as (p: AnyProps) => ReactNode | Promise<ReactNode>)(props);
    if (isPromise(output)) {
      output.catch(() => {}); // a promessa chamada aqui é descartada; o React chama de novo via `element`
      return element;
    }
    return output;
  } catch {
    return kitNode;
  }
}

function renderRegion(model: ThemeRenderModel, key: ThemeRegionKey, Kit: ComponentType<AnyProps>, props: AnyProps): ReactNode {
  const kitNode = <Kit {...props} />;
  if (!model.theme.replacedRegions.includes(key)) return kitNode;
  const Override = model.theme.regions[key] as ComponentType<AnyProps>;
  return (
    <RegionBoundary fallback={kitNode} region={key}>
      {renderOverride(Override, { ...props, Default: Kit }, kitNode)}
    </RegionBoundary>
  );
}

// Decisões de arranjo (L3/§7.8), puras. Ordem de precedência do preset e do modo mobile: seção
// (W6) → opção reservada `layout`/`mobile-nav` (só quando o manifesto declara as escolhas) →
// manifesto/definição. Admin (invariante §0.5) é sempre topbar + drawer, sem opções nem seção.
export type ResolvedArrangement = {
  preset: ThemeLayoutPreset | null; // null = layout custom (componente do tema)
  mobileNav: ThemeMobileNavMode;
  collapseControl: RailRegionProps["collapseControl"];
  headerNavVisibleFrom: HeaderRegionProps["headerNavVisibleFrom"];
};

export function resolveArrangement(model: ThemeRenderModel): ResolvedArrangement {
  const { theme } = model;
  if (model.area === "admin") {
    return { preset: "topbar", mobileNav: "drawer", collapseControl: "rail", headerNavVisibleFrom: "always" };
  }
  const options = model.options.values;
  const declared = theme.manifest.layout;

  let preset: ThemeLayoutPreset | null = typeof theme.layout === "string" ? theme.layout : null;
  const presetOption = options["layout"];
  if (preset !== null) {
    if (typeof presetOption === "string" && (theme.layoutDecl.presetChoices as readonly string[]).includes(presetOption)) {
      preset = presetOption as ThemeLayoutPreset;
    }
  }
  // Seção (§7) troca o arranjo também de um tema com layout próprio (componente): o preset do kit
  // pedido pela seção vence o componente.
  if (model.section?.layoutPreset) preset = model.section.layoutPreset;

  const mobileOption = options["mobile-nav"];
  const mobileNav: ThemeMobileNavMode =
    model.section?.mobileNav ??
    (typeof mobileOption === "string" && (theme.responsive.mobileNavChoices as readonly string[]).includes(mobileOption)
      ? (mobileOption as ThemeMobileNavMode)
      : theme.responsive.mobileNav);

  // Sem declaração no manifesto, o padrão segue o preset: "rail" = arranjo Aurora 0.1.13 (colapso
  // no header, menu do header só a partir de lg); "topbar" = slime (colapso na rail, menu sempre).
  const isRail = preset === "rail";
  return {
    preset,
    mobileNav,
    collapseControl: declared?.collapseControl !== undefined ? theme.layoutDecl.collapseControl : isRail ? "header" : "rail",
    headerNavVisibleFrom:
      declared?.headerNavVisibleFrom !== undefined ? theme.layoutDecl.headerNavVisibleFrom : isRail ? "lg" : "always",
  };
}

// admin-nav vem agrupado (navGroups); a navegação mobile fora da rail recebe a árvore: grupo =
// agregador (href null) com os itens como filhos.
function mobileNavItems(sidebarLeft: ThemeRenderModel["slotProps"]["sidebarLeft"]): MainNavItem[] {
  if (sidebarLeft.navMode !== "admin") return sidebarLeft.navItems;
  return sidebarLeft.navGroups.map((group) => ({
    key: group.key,
    label: group.label,
    href: null,
    children: group.items.map((item) => ({ key: item.key, label: item.label, href: item.href, icon: item.icon })),
  }));
}

export function ThemeRenderer({ model, nonce, children }: { model: ThemeRenderModel; nonce?: string; children: ReactNode }) {
  const { theme, slotProps, page, outlets, contextual } = model;
  const common: RegionCommon = {
    strings: model.strings,
    locale: model.locale,
    dir: model.dir,
    options: model.options.values,
    area: model.area,
  };
  const arrangement = resolveArrangement(model);
  // Outlet vazio = null (não um <ThemeOutlet> que renderiza nada): as regiões do kit decidem
  // markup extra (ex.: wrapper do lado direito do header) pela presença do nó.
  const outlet = (name: ThemeOutletName): ReactNode => (outlets[name] == null ? null : <ThemeOutlet name={name} nodes={outlets} />);

  const sidebarLeft = slotProps.sidebarLeft;
  // A rail é montada sempre que habilitada, mesmo com `page.showRail=false`: o (platform)/layout não
  // re-renderiza na navegação soft, então quem decide se ela aparece (a partir de lg) é o
  // page-layout.css, pelo marcador da página atual. Na carga inicial de uma página sem marcador, o
  // wrapper `data-page-rail-initial` faz o mesmo papel. Abaixo de lg a rail é o drawer da navegação
  // mobile e nunca some por preferência da página.
  const railPresent = sidebarLeft.enabled;
  const railNode = railPresent
    ? renderRegion(model, "rail", KitRail, {
        ...sidebarLeft,
        ...common,
        headerNavItems: slotProps.header.headerNavItems,
        collapseControl: arrangement.collapseControl,
        slots: { outletTop: outlet("rail.top"), outletBottom: outlet("rail.bottom") },
        // extras do kit (ver KitRailProps)
        headerNavVisibleFrom: arrangement.headerNavVisibleFrom,
        arrangement: arrangement.preset === "rail" ? "rail" : "topbar",
        mobileNavMode: arrangement.mobileNav,
      })
    : null;
  const rail =
    railNode && !page.showRail ? (
      <div className="contents" data-page-rail-initial="hidden">
        {railNode}
      </div>
    ) : (
      railNode
    );

  const header = slotProps.header;
  const userMenu =
    header.userbarEnabled && header.user
      ? renderRegion(model, "userMenu", KitUserMenu, {
          ...common,
          user: header.user,
          canAccessAdmin: header.canAccessAdmin,
          onSignOut: header.onSignOut,
          userNavItems: header.userNavItems ?? [],
          slots: { outletItems: outlet("userMenu.items") },
        })
      : null;
  const headerNode = renderRegion(model, "header", KitHeader, {
    ...header,
    ...common,
    sidebarCollapse:
      arrangement.collapseControl === "header" && railPresent && page.showRail
        ? { collapsed: sidebarLeft.collapsed, onToggleCollapsed: sidebarLeft.onToggleCollapsed }
        : null,
    headerNavVisibleFrom: arrangement.headerNavVisibleFrom,
    slots: {
      userMenu,
      // bottom-bar não tem hambúrguer: a barra É a navegação mobile.
      mobileNavToggle: arrangement.mobileNav === "bottom-bar" ? null : <MobileNavToggleButton strings={model.strings} />,
      breadcrumbs: null,
      outletStart: outlet("header.start"),
      outletEnd: outlet("header.end"),
    },
  });
  const footer = renderRegion(model, "footer", KitFooter, {
    ...slotProps.footer,
    ...common,
    slots: { outletTop: outlet("footer.top"), outletBottom: outlet("footer.bottom") },
  });
  // JSON-LD da trilha é do core, logo depois do <nav> (mesma posição em que o Shell 7.x o punha).
  const breadcrumbs =
    model.breadcrumbs.length > 0 ? (
      <>
        {renderRegion(model, "breadcrumbs", KitBreadcrumbs, { ...common, items: model.breadcrumbs })}
        <CoreJsonLd data={model.breadcrumbsJsonLd} nonce={nonce} />
      </>
    ) : null;
  const contextualBar =
    contextual.source !== "none" && page.contextualPlacement !== "none"
      ? renderRegion(model, "contextualBar", KitContextualBar, {
          ...common,
          data: contextual,
          placement: page.contextualPlacement,
          mobile: theme.responsive.contextualBarMobile,
          slots: { outletTop: outlet("contextual.top"), outletBottom: outlet("contextual.bottom") },
        })
      : null;
  const mobileNav = renderRegion(model, "mobileNav", KitMobileNav, {
    ...common,
    mode: arrangement.mobileNav,
    navMode: sidebarLeft.navMode,
    items: mobileNavItems(sidebarLeft),
    headerNavItems: header.headerNavItems,
    // Com rail presente, no modo "drawer" a própria rail é o drawer (paridade com o slime).
    railNode: railPresent ? rail : null,
    navModeSwitch: sidebarLeft.canToggleAdminNav ? (
      <KitNavModeSwitch navMode={sidebarLeft.navMode} onToggleNavMode={sidebarLeft.onToggleNavMode} strings={model.strings} />
    ) : null,
    // extra do kit (ver KitMobileNavProps)
    headerNavVisibleFrom: arrangement.headerNavVisibleFrom,
  });

  // Layouts do kit aceitam KitLayoutProps (ThemeLayoutProps + extras); um layout custom recebe os
  // mesmos extras e pode ignorá-los.
  const Layout = (arrangement.preset !== null ? KIT_LAYOUTS[arrangement.preset] : theme.layout) as ComponentType<KitLayoutProps>;

  return (
    <Layout
      {...common}
      contextualMobile={theme.responsive.contextualBarMobile}
      regions={{ skipLink: <SkipLink strings={model.strings} />, header: headerNode, rail, footer, breadcrumbs, contextualBar, mobileNav }}
      page={page}
    >
      {outlet("content.before")}
      {children}
      {outlet("content.after")}
    </Layout>
  );
}
