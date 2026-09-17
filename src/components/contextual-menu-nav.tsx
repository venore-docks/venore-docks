import Link from "next/link";
import type { ResolvedMenuItem } from "@/contexts/cms";
import { NavIcon } from "@/platform/nav-icons/NavIcon";

// Mesmo princípio de components/sitemap.tsx: recebe a árvore já resolvida (Menu Contextual do
// CMS, via getContextualMenu) e só renderiza — não busca dado sozinho. Usado por
// app/(platform)/layout.tsx como o conteúdo do slot sidebarContextual quando não há conteúdo de
// plugin pra essa rota (ver resolveContextualBarContent).
export function ContextualMenuNav({ items }: { items: ResolvedMenuItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Navegação contextual" className="space-y-1">
      {items.map((item) => (
        <ContextualMenuItem key={item.id} item={item} />
      ))}
    </nav>
  );
}

function ContextualMenuItem({ item }: { item: ResolvedMenuItem }) {
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
        <Link href={item.href} className={linkClassName}>
          {item.icon && <NavIcon iconKey={item.icon} className="size-4" />}
          {item.label}
        </Link>
      )}

      {item.children.length > 0 && (
        <div className="ml-3 space-y-1 border-l border-border pl-2">
          {item.children.map((child) => (
            <ContextualMenuItem key={child.id} item={child} />
          ))}
        </div>
      )}
    </div>
  );
}
