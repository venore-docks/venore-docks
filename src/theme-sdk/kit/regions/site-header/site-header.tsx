import Link from "next/link";
import type { HeaderSlotProps } from "@/contexts/themes/contracts/types";
import type { HeaderRegionProps, RegionCommon, ThemeStrings } from "@/contexts/themes/contracts/v8";
import { t } from "../../i18n/t";
import { regionText } from "../region-strings";
import { UserMenu } from "../user-menu/user-menu";
import { MobileNavToggleButton } from "./mobile-nav-toggle-button";
import { PlatformBrand } from "../../platform-brand";
import { HeaderScrollSentinel } from "./header-scroll-sentinel";
import { SidebarCollapseButton } from "./sidebar-collapse-button";

// Props do header do kit: o shape 7.x (HeaderSlotProps, que o Shell do slime ainda passa) + os
// campos v8 de HeaderRegionProps, todos opcionais aqui. Ausentes = comportamento do slime de
// sempre: toggle mobile e user menu montados pelo próprio header, menu sempre visível, sem botão
// de colapso. O ThemeRenderer passa os campos v8 completos (slots já renderizados).
export type KitHeaderProps = HeaderSlotProps &
  Partial<RegionCommon> & {
    strings?: ThemeStrings;
    sidebarCollapse?: HeaderRegionProps["sidebarCollapse"];
    headerNavVisibleFrom?: HeaderRegionProps["headerNavVisibleFrom"];
    slots?: Partial<HeaderRegionProps["slots"]>;
  };

// `headerNavVisibleFrom` (spec v8 §2.2): abaixo do breakpoint o menu do header some daqui e passa a
// morar na navegação mobile (rail em drawer / tela cheia / folha "Mais"). "always" é o slime.
const HEADER_NAV_CLASS: Record<HeaderRegionProps["headerNavVisibleFrom"], string> = {
  always: "flex flex-1 items-center justify-center gap-1",
  md: "hidden flex-1 items-center justify-center gap-1 md:flex",
  lg: "hidden flex-1 items-center justify-center gap-1 lg:flex",
};

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
  notificationAlert,
  userNavItems,
  showLoginLink,
  strings,
  sidebarCollapse = null,
  headerNavVisibleFrom = "always",
  slots,
}: KitHeaderProps) {
  const navLinkClass =
    "rounded-lg px-3 py-1.5 text-xs font-medium uppercase tracking-caps text-muted-foreground ui-motion-base outline-none hover:bg-muted hover:text-foreground active:bg-muted focus-visible:ring-2 focus-visible:ring-ring";

  // Slots v8 (ThemeRenderer): `undefined` = o header monta a peça do kit como sempre (Shell 7.x);
  // um valor (inclusive null) = a peça já veio renderizada (região userMenu substituível, toggle
  // conforme o modo de navegação mobile — bottom-bar não tem hambúrguer).
  const mobileNavToggle = slots?.mobileNavToggle !== undefined ? slots.mobileNavToggle : <MobileNavToggleButton strings={strings} />;
  const userMenu =
    slots?.userMenu !== undefined ? (
      slots.userMenu
    ) : user ? (
      <UserMenu user={user} canAccessAdmin={canAccessAdmin} onSignOut={onSignOut} userNavItems={userNavItems} strings={strings} />
    ) : null;
  const outletEnd = slots?.outletEnd ?? null;

  const loginLink = showLoginLink ? (
    <Link href="/login" className={navLinkClass}>
      {t(strings, "header.signIn")}
    </Link>
  ) : null;

  const userArea = userbarEnabled ? (
    user ? (
      <div className="flex items-center gap-1.5">
        {outletEnd}
        {notificationAlert && (
          // Alerta de notificação (mensagem não lida ou atividade avaliada) — link/texto já
          // resolvidos pelo registry (platform/notifications/notification-registry.ts). O
          // tema só renderiza o `label`.
          <Link
            href={notificationAlert.href}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground ui-motion-base outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:px-2.5"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            <span className="hidden sm:inline">{notificationAlert.label}</span>
          </Link>
        )}
        {userMenu}
      </div>
    ) : outletEnd ? (
      <div className="flex items-center gap-1.5">
        {outletEnd}
        {loginLink}
      </div>
    ) : (
      loginLink
    )
  ) : (
    outletEnd
  );

  return (
    <>
      {scrollShrinkEnabled && <HeaderScrollSentinel />}
      <header
        id="site-header"
        data-region="header"
        data-scrolled="false"
        className={
          "group/header z-40 flex h-20 items-center justify-between gap-4 border-b border-header-border-subtle bg-card px-4 text-foreground ui-motion-emphasis sm:px-6 lg:h-24 " +
          (stickyEnabled ? "sticky top-0 backdrop-blur-sm " : "") +
          (scrollShrinkEnabled
            ? "data-[scrolled=true]:h-16 data-[scrolled=true]:border-border data-[scrolled=true]:bg-card/85 data-[scrolled=true]:shadow-header data-[scrolled=true]:backdrop-blur-xl "
            : "") +
          (brand.position === "center" ? "relative" : "") +
          // Botão de colapso no header (arranjo "rail"): metade dele entra pela borda inicial, por
          // isso a folga extra antes da marca; `relative` ancora o botão quando o header não é sticky.
          (sidebarCollapse ? (stickyEnabled || brand.position === "center" ? "" : " relative") + " lg:ps-12" : "")
        }
      >
        {sidebarCollapse && <SidebarCollapseButton {...sidebarCollapse} strings={strings} />}
        <div className="flex items-center gap-2">
          {mobileNavToggle}
          <Link
            href="/"
            aria-label={brand.name}
            className={
              "inline-flex items-center rounded-lg py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring " +
              (brand.position === "center" ? "absolute start-1/2 -translate-x-1/2 rtl:translate-x-1/2" : "")
            }
          >
            <PlatformBrand {...brand} isScrolled={false} />
          </Link>
          {slots?.outletStart ?? null}
        </div>

        {headerNavItems.length > 0 && (
          <nav aria-label={regionText(strings, "header.navLabel")} className={HEADER_NAV_CLASS[headerNavVisibleFrom]}>
            {headerNavItems.map((item) => (
              <a key={item.key} href={item.href} className={navLinkClass}>
                {item.label}
              </a>
            ))}
          </nav>
        )}

        {userArea}
      </header>
    </>
  );
}
