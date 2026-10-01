import Link from "next/link";
import type { ContextualBarRegionProps, ContextualMenuItemView } from "@/contexts/themes/contracts/v8";
import { NavIcon } from "@/theme-sdk/ui";
import { t } from "../../i18n/t";

// Barra contextual do kit. Markup do menu é o de components/contextual-menu-nav.tsx (cópia
// literal, sobre ContextualMenuItemView em vez de ResolvedMenuItem do CMS). Dono: W7, que faz
// contextual-menu-nav.tsx reexportar este componente e implementa placement/mobile.
export function KitContextualMenuNav({ items, strings }: { items: ContextualMenuItemView[]; strings?: ContextualBarRegionProps["strings"] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label={t(strings, "contextual.label")} className="space-y-1">
      {items.map((item) => (
        <ContextualMenuItem key={item.key} item={item} />
      ))}
    </nav>
  );
}

function ContextualMenuItem({ item }: { item: ContextualMenuItemView }) {
  const linkClassName =
    "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground ui-motion-base outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div>
      {item.href === null ? (
        <p className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-caps text-muted-foreground/56">
          {item.icon && <NavIcon iconKey={item.icon} className="size-4" />}
          {item.label}
        </p>
      ) : item.isExternal ? (
        <a href={item.href} target="_blank" rel="noopener noreferrer" className={linkClassName}>
          {item.icon && <NavIcon iconKey={item.icon} className="size-4" />}
          {item.label}
        </a>
      ) : (
        <Link
          href={item.href}
          target={item.opensInNewTab ? "_blank" : undefined}
          rel={item.opensInNewTab ? "noopener noreferrer" : undefined}
          className={linkClassName}
        >
          {item.icon && <NavIcon iconKey={item.icon} className="size-4" />}
          {item.label}
        </Link>
      )}

      {item.children.length > 0 && (
        <div className="ml-3 space-y-1 border-l border-border pl-2">
          {item.children.map((child) => (
            <ContextualMenuItem key={child.key} item={child} />
          ))}
        </div>
      )}
    </div>
  );
}

// Região da barra contextual (spec §2.5/§7.5). Recebe o dado explícito — nunca `none`: quem
// renderiza a região (ThemeRenderer / layouts do kit) já não monta <aside> nenhum quando
// `contextual.source === "none"` (B6). Conteúdo: menu do CMS (markup de hoje) ou o nó do slot do
// plugin, entre os outlets contextual.top / contextual.bottom. A moldura (<aside>, placement
// side/top, comportamento mobile) é do layout (ContentFrame, W3).
export function ContextualBar({ data, strings, slots }: ContextualBarRegionProps) {
  return (
    <>
      {slots?.outletTop}
      {data.source === "menu" ? <KitContextualMenuNav items={data.items} strings={strings} /> : data.node}
      {slots?.outletBottom}
    </>
  );
}
