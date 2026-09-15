"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { HeaderUserInfo, NavItem } from "@/contexts/themes/contracts/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ColorModeToggle } from "@/components/color-mode-toggle";

function initials(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

type UserMenuProps = {
  user: HeaderUserInfo;
  canAccessAdmin: boolean;
  onSignOut: () => Promise<void>;
  // Links que plugins ativos contribuem pro menu do usuário (ex.: "Mensagens" do Academy) —
  // resolvido na composição (resolveThemeSlotProps), o tema só renderiza. `icon` é ignorado aqui:
  // os itens fixos do menu ("Minha conta", "Administração") também são só texto.
  userNavItems?: NavItem[];
};

// Dropdown com <details>/<summary> (mesmo padrão de src/app/(auth)/login/page.tsx) — só
// "use client" pra cobrir o que HTML puro não dá: <details> nativo não fecha sozinho ao clicar
// fora. O listener de mousedown fecha explicitamente quando o clique é fora; abrir/fechar pelo
// summary, foco e teclado continuam 100% nativos. `group` aqui é o próprio <details> (abre/fecha
// o dropdown). Sem mais reação ao scroll do header — no refator premium o header não inverte de
// cor, então o user-menu não precisa de variantes `group-data-[scrolled=true]/header:`.
const menuItemClass =
  "cursor-pointer rounded-lg px-2.5 py-2 text-sm text-muted-foreground ui-motion-base outline-none hover:bg-muted hover:text-foreground active:bg-muted active:text-foreground focus-visible:ring-2 focus-visible:ring-ring";

export function UserMenu({ user, canAccessAdmin, onSignOut, userNavItems = [] }: UserMenuProps) {
  const firstName = user.displayName.split(/\s+/)[0];
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const details = detailsRef.current;
      if (!details || !details.open) return;
      if (event.target instanceof Node && !details.contains(event.target)) {
        details.open = false;
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <details ref={detailsRef} className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full py-1 pr-2 pl-1 ui-motion-base outline-none hover:bg-muted active:bg-muted focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <Avatar>
          {user.imageUrl ? <AvatarImage src={user.imageUrl} alt={user.displayName} /> : null}
          <AvatarFallback>{initials(user.displayName)}</AvatarFallback>
        </Avatar>
        <span className="hidden text-sm font-medium sm:inline">{firstName}</span>
      </summary>

      <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-panel border border-border bg-popover p-2 text-popover-foreground shadow-float">
        <div className="border-b border-border px-2 pt-1.5 pb-3">
          <p className="truncate text-sm font-semibold">{user.displayName}</p>
          {user.email ? <p className="truncate text-xs text-muted-foreground">{user.email}</p> : null}
        </div>

        <div className="flex flex-col gap-0.5 py-1.5">
          <ColorModeToggle className={menuItemClass} />

          {canAccessAdmin ? (
            <Link href="/admin" className={menuItemClass}>
              Administração
            </Link>
          ) : null}

          <Link href="/account" className={menuItemClass}>
            Minha conta
          </Link>

          {userNavItems.map((item) => (
            <Link key={item.key} href={item.href} className={menuItemClass}>
              {item.label}
            </Link>
          ))}
        </div>

        <form action={onSignOut} className="border-t border-border pt-1.5">
          <button type="submit" className={menuItemClass + " w-full text-left font-medium"}>
            Sair
          </button>
        </form>
      </div>
    </details>
  );
}
