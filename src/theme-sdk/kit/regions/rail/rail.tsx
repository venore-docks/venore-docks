"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { ChevronLeft, ChevronRight, Globe2, ShieldCheck, type LucideIcon } from "lucide-react";
import type { NavItem, SidebarLeftSlotProps } from "@/contexts/themes/contracts/types";
import type { HeaderRegionProps, RailRegionProps, RegionCommon, ThemeMobileNavMode, ThemeStrings } from "@/contexts/themes/contracts/v8";
import { t } from "../../i18n/t";
import { cn } from "@/lib/utils";
import { useSidebarCollapse } from "../../hooks/use-sidebar-collapse";
import { regionText } from "../region-strings";
import { MobileNavDrawer } from "../mobile-nav/mobile-nav-drawer";
import { SidebarNavLink } from "./sidebar-nav-link";
import { SIDEBAR_COLLAPSE_TOOLTIP_COLLAPSED_CLASSES } from "./sidebar-collapse-tooltip";

// Exclusivo de navegação (main-nav ou admin-nav, conforme navMode) — não é área de widgets. O
// toggle main-nav/admin-nav mora aqui, não no Header (docs/venore-docks.md — "Shell única"),
// ANTES da navegação (não depois — pedido desta sessão, e é onde o protótipo de referência
// coloca o SidebarSurfaceSwitch: platform-sidebar.tsx, dentro de um bloco com border-b no topo).
//
// Abaixo de lg vira drawer off-canvas (MobileNavDrawer, client) fechado por padrão; a partir de
// lg volta a ser a coluna fixa de sempre. Colapso (docs/ui/shell-spec.md §3.1-3.2) é exclusivo do
// desktop: `collapsedFromServer` vem resolvido do cookie no servidor (get-sidebar-collapsed.ts),
// então a largura certa está presente no primeiro HTML — sem flash de layout pós-hidratação. A
// partir daí o componente é client e o estado vive no store otimista de colapso (bug desta sessão: o toggle era
// um `<form action={onToggleCollapsed}>` só-servidor — cada clique esperava o round-trip da
// Server Action pra o cookie voltar lido e só então a classe de largura mudar, então a transição
// CSS começava num instante que variava com a latência da rede em vez de no clique). Estado local
// muda a classe na hora; a Server Action ainda roda por baixo (via startTransition, sem bloquear a
// animação) só pra persistir o cookie e o próximo carregamento completo continuar acertando de
// primeira — não é o padrão client-only sem persistência que o protótipo tinha e que já foi
// registrado como "não portar" (docs/ui/shell-spec.md §3.3/§6.3).
//
// v8 (spec §2.5 RailRegionProps): `collapseControl` decide onde mora o botão de colapso ("rail" =
// aqui, como no slime; "header" = SidebarCollapseButton no header, arranjo Aurora; "none" = sem
// botão) — o estado é o store compartilhado (useSidebarCollapse), nunca um useState local. Extras
// do kit, opcionais: `arrangement` (sticky em altura total no layout "rail"), `mobileNavMode`
// (fora de "drawer" a rail não vira off-canvas) e `headerNavVisibleFrom` (quando o menu do header
// some abaixo de um breakpoint, ele reaparece no fim do drawer).
//
// `<nav>` precisa do próprio `flex-1 min-h-0 overflow-y-auto`: o `<aside>` já preenche a altura
// inteira (h-full, sem override lg:h-auto — bug desta sessão), mas sem isso o elemento de
// navegação em si parava do tamanho do conteúdo, deixando espaço vazio abaixo em vez de esticar
// (e rolar por conta própria se a lista crescer além da viewport).
export function SidebarLeftSlot({
  enabled,
  navMode,
  navItems,
  navGroups,
  canToggleAdminNav,
  onToggleNavMode,
  collapsed: collapsedFromServer,
  onToggleCollapsed,
  strings,
  headerNavItems = [],
  collapseControl = "rail",
  headerNavVisibleFrom = "always",
  slots,
  arrangement = "topbar",
  mobileNavMode = "drawer",
}: KitRailProps) {
  const { collapsed, toggle: handleToggleCollapsed } = useSidebarCollapse(collapsedFromServer, onToggleCollapsed);

  if (!enabled) return null;

  const isAdmin = navMode === "admin";
  const offCanvas = mobileNavMode === "drawer";
  const drawerHeaderNav = offCanvas && headerNavVisibleFrom !== "always" ? headerNavItems : [];

  return (
    <MobileNavDrawer
      strings={strings}
      offCanvas={offCanvas}
      arrangement={arrangement}
      asideClassName={cn(
        // px-5 é fixo em qualquer breakpoint e em qualquer estado de collapsed — a faixa de
        // largura do ícone não pode depender da largura do sidebar (bug desta sessão: padding
        // não está na lista de propriedades de ui-motion-emphasis, então px-5→px-3 trocava
        // instantaneamente enquanto a largura do <aside> ainda levava 300ms pra terminar,
        // deslocando o ícone antes do fim da transição). Só `width` anima.
        "relative flex h-full w-full flex-col px-5 py-6 text-foreground shadow-float lg:w-(--sidebar-width-expanded) lg:shrink-0 lg:border-e lg:shadow-none ui-motion-emphasis",
        isAdmin ? "border-ring bg-(image:--sidebar-bg-admin)" : "border-border bg-(image:--sidebar-bg)",
        collapsed && "lg:w-(--sidebar-width-collapsed)",
      )}
    >
      {/* z-50 (não z-10): esse botão flutua pra fora da sidebar (translate-x-1/2) sobre a coluna
          de conteúdo, onde o HeaderSlot mora — header é sticky com z-40, e com z-10 o header
          ficava por cima e cortava a seta ao meio (mesmo bug corrigido nos temas
          aurora/nebula/vega/halo/harbor — venore-slime tinha a mesma cópia, sem o fix). */}
      {collapseControl === "rail" && (
      <div className="absolute top-4 end-0 z-50 hidden translate-x-1/2 rtl:-translate-x-1/2 lg:block">
        <button
          type="button"
          onClick={handleToggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t(strings, "rail.expand") : t(strings, "rail.collapse")}
          className="flex size-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-panel ui-motion-base outline-none hover:bg-muted hover:border-ring active:border-ring focus-visible:ring-2 focus-visible:ring-ring"
        >
          {collapsed ? (
            <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          ) : (
            <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
          )}
        </button>
      </div>
      )}

      {canToggleAdminNav && (
        // pt-8: espaço reservado pro botão flutuante de colapso (top-4, size-11), que fica
        // sobreposto ao canto superior direito do frame — mesma folga em expandido/colapsado pra
        // não depender de cálculo fino de onde a coluna direita do pill termina.
        <div className="shrink-0 border-b border-border pt-8 pb-4">
          <SidebarSurfaceSwitch isAdmin={isAdmin} collapsed={collapsed} onToggleNavMode={onToggleNavMode} strings={strings} />
        </div>
      )}

      {slots?.outletTop ?? null}

      <nav
        aria-label={regionText(strings, isAdmin ? "rail.adminNavLabel" : "rail.navLabel")}
        data-nav-mode={navMode}
        className={cn(
          "min-h-0 flex-1 space-y-1 overflow-y-auto",
          // Sem o switch acima (usuário sem permissão admin), o <nav> é o primeiro filho — precisa
          // da mesma folga pro botão flutuante de colapso que o bloco do switch reserva.
          canToggleAdminNav ? "pt-2" : "pt-8",
        )}
      >
        {isAdmin
          ? navGroups.map((group) => (
              <div key={group.key} className="space-y-1 pb-4">
                {/* Título da seção (expandido) e divisor fino (colapsado) ocupam uma faixa de
                    altura FIXA e sempre presente no flex flow — nunca `hidden`/`block` (bug desta
                    sessão: display:none tira o elemento do cálculo de layout no mesmo quadro em
                    que troca, deslocando os ícones do grupo pra cima antes do <aside> terminar de
                    animar a largura). Título e divisor só fazem crossfade de opacidade por cima
                    um do outro; a altura do bloco nunca muda. */}
                <div className="relative h-5">
                  <p
                    className={cn(
                      "absolute inset-0 px-3 pb-1 text-[11px] font-semibold uppercase tracking-caps text-muted-foreground/70 ui-motion-emphasis",
                      collapsed && "lg:opacity-0",
                    )}
                  >
                    {group.label}
                  </p>
                  <div
                    className={cn("absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-border opacity-0 ui-motion-emphasis", collapsed && "lg:opacity-100")}
                    aria-hidden="true"
                  />
                </div>
                {group.items.map((item) => (
                  <SidebarNavLink key={item.key} item={item} collapsed={collapsed} isAdmin={isAdmin} />
                ))}
              </div>
            ))
          : navItems.map((item) => <SidebarNavLink key={item.key} item={item} collapsed={collapsed} isAdmin={isAdmin} />)}

        {isAdmin && navGroups.length === 0 && (
          <p className="px-3 text-sm text-muted-foreground/56">—</p>
        )}
        {!isAdmin && navItems.length === 0 && <p className="px-3 text-sm text-muted-foreground/56">—</p>}

        {drawerHeaderNav.length > 0 && <DrawerHeaderNav items={drawerHeaderNav} visibleFrom={headerNavVisibleFrom} />}
      </nav>

      {slots?.outletBottom ?? null}
    </MobileNavDrawer>
  );
}

export type KitRailProps = SidebarLeftSlotProps &
  Partial<RegionCommon> & {
    strings?: ThemeStrings;
    headerNavItems?: NavItem[];
    collapseControl?: RailRegionProps["collapseControl"];
    slots?: Partial<RailRegionProps["slots"]>;
    headerNavVisibleFrom?: HeaderRegionProps["headerNavVisibleFrom"];
    arrangement?: "topbar" | "rail";
    mobileNavMode?: ThemeMobileNavMode;
  };

// Menu do header no fim do drawer, só abaixo do breakpoint em que ele some do header (Aurora 0.1.13).
function DrawerHeaderNav({ items, visibleFrom }: { items: NavItem[]; visibleFrom: "md" | "lg" | "always" }) {
  return (
    <div className={cn("mt-4 space-y-1 border-t border-border pt-4", visibleFrom === "md" ? "md:hidden" : "lg:hidden")}>
      {items.map((item) => (
        <a
          key={item.key}
          href={item.href}
          className="flex rounded-lg px-3 py-2.5 text-xs font-medium uppercase tracking-caps text-muted-foreground ui-motion-base outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}

// Alternância site/admin avulsa (só o pill), pras camadas mobile que não mostram a rail
// ("bottom-bar", "fullscreen") — o ThemeRenderer passa como `navModeSwitch` da região mobileNav.
export function KitNavModeSwitch({
  navMode,
  onToggleNavMode,
  strings,
}: {
  navMode: SidebarLeftSlotProps["navMode"];
  onToggleNavMode: () => Promise<void>;
  strings?: ThemeStrings;
}): ReactNode {
  return <SidebarSurfaceSwitch isAdmin={navMode === "admin"} collapsed={false} onToggleNavMode={onToggleNavMode} strings={strings} />;
}

function SidebarSurfaceSwitch({
  isAdmin,
  collapsed,
  onToggleNavMode,
  strings,
}: {
  isAdmin: boolean;
  collapsed: boolean;
  onToggleNavMode: () => Promise<void>;
  strings?: ThemeStrings;
}) {
  const label = isAdmin ? t(strings, "rail.exitAdmin") : t(strings, "rail.enterAdmin");

  return (
    <>
      {/* Ícone único — colapso é conceito exclusivo de desktop (docs/ui/shell-spec.md §3.1): o
          off-canvas mobile ignora o cookie e sempre mostra o pill completo abaixo, mesmo com
          collapsed=true, por isso este bloco só aparece via `lg:flex` quando de fato colapsada,
          nunca por padrão (mobile-first). */}
      <form action={onToggleNavMode} className={cn("hidden justify-center", collapsed && "lg:flex")}>
        <NavModeIconButton isAdmin={isAdmin} label={label} />
      </form>

      {/* Pill de dois segmentos — versão padrão (mobile e desktop expandido); some só em
          `lg:` quando colapsada, pra não duplicar o controle acima. Um único form (o toggle é
          sempre "inverte o modo atual", não "vá pro modo X"): o segmento já ativo fica disabled —
          visualmente marcado, mas sem submeter de novo — só o inativo dispara onToggleNavMode. */}
      <form
        action={onToggleNavMode}
        className={cn("relative grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted p-1", collapsed && "lg:hidden")}
      >
      <NavModeIndicator isAdmin={isAdmin} />
      <NavModeSegmentButton isActive={!isAdmin} icon={Globe2} text={t(strings, "rail.site")} />
      <NavModeSegmentButton isActive={isAdmin} icon={ShieldCheck} text={t(strings, "rail.admin")} />
      </form>
    </>
  );
}

// A troca de navMode depende de um round-trip de Server Action (cookie só é lido no próximo
// render do RootLayout — get-nav-mode.ts): navItems/navGroups vêm do servidor já filtrados pelo
// modo. O controle em si é otimista: com o <form> pendente (useFormStatus), o indicador desliza e
// o ícone troca na hora para o modo de destino, e a interação trava até o refresh da rota chegar —
// sem spinner, a troca parece imediata (era assim no Aurora 0.1.x).
function NavModeIndicator({ isAdmin }: { isAdmin: boolean }) {
  const { pending } = useFormStatus();
  const showAdmin = pending ? !isAdmin : isAdmin;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-y-1 z-0 w-[calc(50%-0.125rem)] rounded-lg border border-ring bg-card shadow-panel ui-motion-base",
        showAdmin ? "start-[calc(50%+0.125rem)]" : "start-1",
      )}
    />
  );
}

function NavModeIconButton({ isAdmin, label }: { isAdmin: boolean; label: string }) {
  const { pending } = useFormStatus();
  const showAdmin = pending ? !isAdmin : isAdmin;

  return (
    <button
      type="submit"
      aria-label={label}
      aria-busy={pending}
      disabled={pending}
      className={cn(
        "group/sidebar-collapse-target relative flex size-11 items-center justify-center rounded-xl border border-border bg-muted text-foreground shadow-panel ui-motion-base outline-none hover:border-ring active:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait",
        !pending && "cursor-pointer",
      )}
    >
      {showAdmin ? <ShieldCheck className="size-4" aria-hidden="true" /> : <Globe2 className="size-4" aria-hidden="true" />}
      <span className={cn("max-w-0 overflow-hidden whitespace-nowrap opacity-0", SIDEBAR_COLLAPSE_TOOLTIP_COLLAPSED_CLASSES)}>
        {label}
      </span>
    </button>
  );
}

function NavModeSegmentButton({ isActive, icon: Icon, text }: { isActive: boolean; icon: LucideIcon; text: string }) {
  const { pending } = useFormStatus();
  // O segmento inativo é o alvo do clique (o toggle sempre inverte o modo atual); pendente, ele já
  // aparece ativo (otimista) enquanto o servidor devolve a navegação do novo modo.
  const isTarget = !isActive;
  const looksActive = pending ? isTarget : isActive;

  return (
    <button
      type="submit"
      disabled={isActive || pending}
      aria-current={isActive ? true : undefined}
      aria-busy={isTarget && pending ? true : undefined}
      className={cn(
        "relative z-10 flex h-9 items-center justify-center gap-2 rounded-lg text-xs font-semibold uppercase tracking-caps ui-motion-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
        looksActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        isTarget && !pending && "cursor-pointer",
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      {text}
    </button>
  );
}
