"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MainNavItem, NavItem } from "@/contexts/themes/contracts/types";
import { cn, NavIcon } from "@/theme-sdk/ui";

// Lista de navegação das camadas mobile (drawer sem rail, tela cheia, folha "Mais"). Árvore do
// main-nav: agregador (href null) vira rótulo de grupo com os filhos sempre abertos — numa camada
// mobile não há accordion. Client só por causa do aria-current (usePathname), igual ao
// SidebarNavLink. O menu do header entra no fim, separado, quando ele some do header no mobile.
const linkClass =
  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground ui-motion-base outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-primary/10 aria-[current=page]:font-semibold aria-[current=page]:text-primary";

function ItemLink({ item, pathname }: { item: Extract<MainNavItem, { href: string }>; pathname: string | null }) {
  const icon = (
    <span aria-hidden="true" className="inline-flex size-5 shrink-0 items-center justify-center">
      <NavIcon iconKey={item.icon} className="size-4 shrink-0" />
    </span>
  );
  if (item.isExternal) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {icon}
        {item.label}
      </a>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={pathname === item.href ? "page" : undefined}
      target={item.opensInNewTab ? "_blank" : undefined}
      rel={item.opensInNewTab ? "noopener noreferrer" : undefined}
      className={linkClass}
    >
      {icon}
      {item.label}
    </Link>
  );
}

function Items({ items, pathname }: { items: MainNavItem[]; pathname: string | null }) {
  return (
    <ul className="space-y-1">
      {items.map((item) =>
        item.href === null ? (
          <li key={item.key} className="pt-2">
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-caps text-muted-foreground/56">{item.label}</p>
            <div className="ps-3">
              <Items items={item.children} pathname={pathname} />
            </div>
          </li>
        ) : (
          <li key={item.key}>
            <ItemLink item={item} pathname={pathname} />
          </li>
        ),
      )}
    </ul>
  );
}

export function MobileNavList({ items, headerNavItems = [], className }: { items: MainNavItem[]; headerNavItems?: NavItem[]; className?: string }) {
  const pathname = usePathname();
  return (
    <div className={cn("space-y-4", className)}>
      {items.length > 0 && <Items items={items} pathname={pathname} />}
      {headerNavItems.length > 0 && (
        <ul className={cn("space-y-1", items.length > 0 && "border-t border-border pt-4")}>
          {headerNavItems.map((item) => (
            <li key={item.key}>
              <a
                href={item.href}
                className="flex rounded-lg px-3 py-2.5 text-xs font-medium uppercase tracking-caps text-muted-foreground ui-motion-base outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
