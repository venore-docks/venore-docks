import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { SitemapItem } from "@/contexts/themes";

// Componente reutilizável (não é código embutido no footer): recebe a árvore já resolvida pelo
// menu de location "sitemap" (contexts/cms, via platform/theme-rendering/to-sitemap-items.ts) e só
// renderiza — não busca dado sozinho. Primeiro nível vira cabeçalho de coluna (desktop) / cabeçalho
// de acordeão (mobile); filhos são os links daquela coluna. Sem menu configurado, `items` chega
// vazio e este componente não renderiza nada — quem decide isso é o menu, não este componente.
export function Sitemap({ items }: { items: SitemapItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Mapa do site">
      <div className="hidden gap-x-10 gap-y-6 sm:grid sm:grid-cols-2 lg:grid-cols-3">
        {items.map((column) => (
          <div key={column.key} className="space-y-2.5">
            <SitemapColumnHeading item={column} />
            <SitemapChildrenList items={column.children} />
          </div>
        ))}
      </div>

      <div className="space-y-1 sm:hidden">
        {items.map((column) => (
          <details key={column.key} className="group border-b border-border py-2">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <SitemapColumnHeading item={column} />
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform ui-motion-base group-open:rotate-180" />
            </summary>
            <SitemapChildrenList items={column.children} className="pb-2 pl-1 pt-2" />
          </details>
        ))}
      </div>
    </nav>
  );
}

function SitemapColumnHeading({ item }: { item: SitemapItem }) {
  const className = "text-[11px] font-semibold uppercase tracking-caps text-muted-foreground";

  // "Rótulo sem link" (targetType "label" no menu) é o caso de uso principal do primeiro nível —
  // cabeçalho de grupo não clicável. Se o item de primeiro nível tiver href, ainda funciona como
  // cabeçalho da coluna, só que clicável.
  if (item.href === null) {
    return <p className={className}>{item.label}</p>;
  }

  return (
    <SitemapAnchor
      label={item.label}
      href={item.href}
      isExternal={item.isExternal}
      opensInNewTab={item.opensInNewTab}
      className={`${className} block rounded-xl ui-motion-base outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring`}
    />
  );
}

function SitemapChildrenList({ items, className = "" }: { items: SitemapItem[]; className?: string }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className={`space-y-2.5 ${className}`.trim()}>
      {items.map((child) => (
        <li key={child.key}>
          {child.href === null ? (
            <span className="block text-sm text-muted-foreground">{child.label}</span>
          ) : (
            <SitemapAnchor
              label={child.label}
              href={child.href}
              isExternal={child.isExternal}
              opensInNewTab={child.opensInNewTab}
              className="block rounded-xl text-sm text-muted-foreground ui-motion-base outline-none hover:text-primary active:text-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function SitemapAnchor({
  label,
  href,
  isExternal,
  opensInNewTab,
  className,
}: {
  label: string;
  href: string;
  isExternal: boolean;
  opensInNewTab: boolean;
  className: string;
}) {
  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {label}
      </a>
    );
  }

  return (
    <Link
      href={href}
      target={opensInNewTab ? "_blank" : undefined}
      rel={opensInNewTab ? "noopener noreferrer" : undefined}
      className={className}
    >
      {label}
    </Link>
  );
}
