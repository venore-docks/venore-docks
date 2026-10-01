import { Suspense, type ComponentType, type ReactNode } from "react";
import type { RegionCommon, ThemeRegionKey, ThemeRenderModel } from "@/contexts/themes/contracts/v8";
import { KIT_LAYOUTS } from "@/theme-sdk/kit/layouts";
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
} from "@/theme-sdk/kit/regions";

// Renderer v8 (spec §6). Esqueleto da Fase F; dono a partir daqui: W3 (layouts/regiões do kit).
// Cada região é a do kit, ou o override do tema embrulhado em boundary (client) + Suspense (SSR),
// ambos com a região do kit como fallback — um override que lança nunca derruba a página.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = any;

function renderRegion(model: ThemeRenderModel, key: ThemeRegionKey, Kit: ComponentType<AnyProps>, props: AnyProps): ReactNode {
  const kitNode = <Kit {...props} />;
  if (!model.theme.replacedRegions.includes(key)) return kitNode;
  const Override = model.theme.regions[key] as ComponentType<AnyProps>;
  return (
    <RegionBoundary fallback={kitNode}>
      <Suspense fallback={kitNode}>
        <Override {...props} Default={Kit} />
      </Suspense>
    </RegionBoundary>
  );
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
  const outlet = (name: Parameters<typeof ThemeOutlet>[0]["name"]) => <ThemeOutlet name={name} nodes={outlets} />;

  const header = renderRegion(model, "header", KitHeader, {
    ...slotProps.header,
    ...common,
    sidebarCollapse: null,
    headerNavVisibleFrom: theme.layoutDecl.headerNavVisibleFrom,
    slots: { userMenu: null, mobileNavToggle: null, breadcrumbs: null, outletStart: outlet("header.start"), outletEnd: outlet("header.end") },
  });
  const rail = page.showRail
    ? renderRegion(model, "rail", KitRail, {
        ...slotProps.sidebarLeft,
        ...common,
        headerNavItems: slotProps.header.headerNavItems,
        collapseControl: theme.layoutDecl.collapseControl,
        slots: { outletTop: outlet("rail.top"), outletBottom: outlet("rail.bottom") },
      })
    : null;
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
    mode: theme.responsive.mobileNav,
    navMode: slotProps.sidebarLeft.navMode,
    items: slotProps.sidebarLeft.navItems,
    headerNavItems: slotProps.header.headerNavItems,
    railNode: null,
    navModeSwitch: null,
  });

  const Layout = typeof theme.layout === "string" ? KIT_LAYOUTS[theme.layout] : theme.layout;

  return (
    <Layout
      {...common}
      regions={{ skipLink: null, header, rail, footer, breadcrumbs, contextualBar, mobileNav }}
      page={page}
    >
      {outlet("content.before")}
      {children}
      {outlet("content.after")}
    </Layout>
  );
}
