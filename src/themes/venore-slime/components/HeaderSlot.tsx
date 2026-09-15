import Link from "next/link";
import type { HeaderSlotProps } from "@/contexts/themes/contracts/types";
import { UserMenu } from "./UserMenu";
import { MobileNavToggleButton } from "./MobileNavToggleButton";
import { PlatformBrand } from "./PlatformBrand";
import { HeaderScrollSentinel } from "./HeaderScrollSentinel";

// Header compacto que se ELEVA ao rolar em vez de inverter de cor (refator premium: a inversão
// pra bg-primary/text-primary-foreground era chamativa demais). Continua server component; o
// único client real é HeaderScrollSentinel (sibling), que escreve `data-scrolled` no <header> via
// DOM. Todo o resto reage por seletor CSS (`data-[scrolled=true]:` no próprio elemento) — nunca
// via prop `isScrolled` recomputada em React. Único que recebe `isScrolled` boolean de verdade é
// PlatformBrand, porque também roda fora do header (preview de admin/settings/brand).
//
// Estados:
//   top      → bg-card, borda hairline, sem sombra; altura h-16 / lg:h-20.
//   scrolled → mesma cor de fundo translúcida + backdrop-blur (efeito "frosted"), borda mais
//              definida, shadow-header, altura h-14. Sem troca de paleta.
//
// T4: stickyEnabled/scrollShrinkEnabled vêm de contexts/settings (platform/header-behavior).
// stickyEnabled também liga o backdrop-blur no estado top (um header fixo sobre conteúdo que
// rola fica melhor levemente fosco). scrollShrinkEnabled=false → HeaderScrollSentinel nem monta,
// então `data-scrolled` fica sempre "false" e as classes data-[scrolled=true] nunca casam.
export function HeaderSlot({
  brand,
  userbarEnabled,
  stickyEnabled,
  scrollShrinkEnabled,
  headerNavItems,
  user,
  canAccessAdmin,
  onSignOut,
  messageAlert,
  userNavItems,
}: HeaderSlotProps) {
  const navLinkClass =
    "rounded-lg px-3 py-1.5 text-xs font-medium uppercase tracking-caps text-muted-foreground ui-motion-base outline-none hover:bg-muted hover:text-foreground active:bg-muted focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <>
      {scrollShrinkEnabled && <HeaderScrollSentinel />}
      <header
        id="site-header"
        data-scrolled="false"
        className={
          "group/header z-40 flex h-20 items-center justify-between gap-4 border-b border-header-border-subtle bg-card px-4 text-foreground ui-motion-emphasis sm:px-6 lg:h-24 " +
          (stickyEnabled ? "sticky top-0 backdrop-blur-sm " : "") +
          (scrollShrinkEnabled
            ? "data-[scrolled=true]:h-16 data-[scrolled=true]:border-border data-[scrolled=true]:bg-card/85 data-[scrolled=true]:shadow-header data-[scrolled=true]:backdrop-blur-xl "
            : "") +
          (brand.position === "center" ? "relative" : "")
        }
      >
        <div className="flex items-center gap-2">
          <MobileNavToggleButton />
          <Link
            href="/"
            aria-label={brand.name}
            className={
              "inline-flex items-center rounded-lg py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring " +
              (brand.position === "center" ? "absolute left-1/2 -translate-x-1/2" : "")
            }
          >
            <PlatformBrand {...brand} isScrolled={false} />
          </Link>
        </div>

        {headerNavItems.length > 0 && (
          <nav className="flex flex-1 items-center justify-center gap-1">
            {headerNavItems.map((item) => (
              <a key={item.key} href={item.href} className={navLinkClass}>
                {item.label}
              </a>
            ))}
          </nav>
        )}

        {userbarEnabled ? (
          user ? (
            <div className="flex items-center gap-1.5">
              {messageAlert && (
                // Alerta de notificação (mensagem não lida ou atividade avaliada) — link/texto já
                // resolvidos pelo registry (platform/notifications/notification-registry.ts). O
                // tema só renderiza o `label`.
                <Link
                  href={messageAlert.href}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground ui-motion-base outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:px-2.5"
                >
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-primary" />
                  </span>
                  <span className="hidden sm:inline">{messageAlert.label}</span>
                </Link>
              )}
              <UserMenu user={user} canAccessAdmin={canAccessAdmin} onSignOut={onSignOut} userNavItems={userNavItems} />
            </div>
          ) : (
            <Link href="/login" className={navLinkClass}>
              Entrar
            </Link>
          )
        ) : null}
      </header>
    </>
  );
}
