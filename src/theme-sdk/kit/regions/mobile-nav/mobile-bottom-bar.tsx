"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis } from "lucide-react";
import { cn, NavIcon } from "@/theme-sdk/ui";
import type { ThemeStrings } from "@/contexts/themes/contracts/v8";
import { t } from "../../i18n/t";
import { regionText } from "../region-strings";
import { useOverlay } from "../../hooks/use-overlay";
import { useScrollLock } from "../../hooks/use-scroll-lock";

export const KIT_MOBILE_MORE_PANEL_ID = "kit-mobile-more";
export const MOBILE_BOTTOM_BAR_MAX_ITEMS = 5;

export type BottomBarItem = { key: string; label: string; href: string; icon?: string; isExternal?: boolean; opensInNewTab?: boolean };

const itemClass =
  "flex h-full flex-col items-center justify-center gap-1 px-1 text-xs font-medium text-muted-foreground ui-motion-base outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-[current=page]:text-primary aria-expanded:text-foreground";

// Modo "bottom-bar" (spec v8 §7.8): barra fixa no rodapé da tela, abaixo de lg, com até 5 itens
// de primeiro nível + "Mais" (aria-expanded) que abre uma folha com o resto (agregadores, itens
// excedentes, menu do header, alternância site/admin). A altura da barra é a variável
// `--mobile-bottom-bar-height` (múltiplo do token de espaçamento), definida no wrapper: a própria
// barra e um espaçador no fim da página usam o mesmo valor, então o conteúdo/rodapé nunca fica
// escondido atrás dela.
export function MobileBottomBar({ items, more, strings }: { items: BottomBarItem[]; more: ReactNode | null; strings?: ThemeStrings }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useOverlay({ open, onClose: () => setOpen(false), containerRef: panelRef, returnFocus: () => triggerRef.current });
  useScrollLock(open);

  return (
    <div className="contents [--mobile-bottom-bar-height:calc(var(--spacing)*16)]">
      <nav
        aria-label={regionText(strings, "mobileNav.label")}
        data-region="mobile-nav"
        data-mobile-nav="bottom-bar"
        className="fixed inset-x-0 bottom-0 z-40 h-(--mobile-bottom-bar-height) border-t border-border bg-card text-foreground shadow-float lg:hidden"
      >
        <ul className="flex h-full items-stretch">
          {items.map((item) => (
            <li key={item.key} className="min-w-0 flex-1">
              {item.isExternal ? (
                <a href={item.href} target="_blank" rel="noopener noreferrer" className={itemClass}>
                  <NavIcon iconKey={item.icon} className="size-5 shrink-0" />
                  <span className="max-w-full truncate">{item.label}</span>
                </a>
              ) : (
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  target={item.opensInNewTab ? "_blank" : undefined}
                  rel={item.opensInNewTab ? "noopener noreferrer" : undefined}
                  className={itemClass}
                >
                  <NavIcon iconKey={item.icon} className="size-5 shrink-0" />
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              )}
            </li>
          ))}
          {more != null && (
            <li className="min-w-0 flex-1">
              <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-controls={KIT_MOBILE_MORE_PANEL_ID}
                aria-label={regionText(strings, "mobileNav.moreLabel")}
                className={cn(itemClass, "w-full")}
              >
                <Ellipsis className="size-5 shrink-0" aria-hidden="true" />
                <span>{regionText(strings, "mobileNav.more")}</span>
              </button>
            </li>
          )}
        </ul>
      </nav>
      <div aria-hidden="true" data-mobile-bottom-bar-spacer className="h-(--mobile-bottom-bar-height) lg:hidden" />
      {more != null && (
        <>
          {open && (
            <button
              type="button"
              aria-label={t(strings, "mobileNav.close")}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-popover/80 lg:hidden"
            />
          )}
          <div
            ref={panelRef}
            id={KIT_MOBILE_MORE_PANEL_ID}
            role="dialog"
            aria-modal="true"
            aria-label={regionText(strings, "mobileNav.moreLabel")}
            inert={!open}
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto overscroll-contain rounded-t-2xl border-t border-border bg-card px-4 pt-4 pb-(--mobile-bottom-bar-height) text-foreground shadow-float ui-motion-emphasis lg:hidden",
              open ? "translate-y-0" : "translate-y-full",
            )}
          >
            {more}
          </div>
        </>
      )}
    </div>
  );
}
