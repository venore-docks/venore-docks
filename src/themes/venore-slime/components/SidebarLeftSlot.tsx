"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { ChevronLeft, ChevronRight, Globe2, Loader2, ShieldCheck, type LucideIcon } from "lucide-react";
import type { SidebarLeftSlotProps } from "@/contexts/themes/contracts/types";
import { cn } from "@/lib/utils";
import { MobileNavDrawer } from "./MobileNavDrawer";
import { SidebarNavLink } from "./SidebarNavLink";
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
// partir daí o componente é client e mantém o próprio `useState` (bug desta sessão: o toggle era
// um `<form action={onToggleCollapsed}>` só-servidor — cada clique esperava o round-trip da
// Server Action pra o cookie voltar lido e só então a classe de largura mudar, então a transição
// CSS começava num instante que variava com a latência da rede em vez de no clique). Estado local
// muda a classe na hora; a Server Action ainda roda por baixo (via startTransition, sem bloquear a
// animação) só pra persistir o cookie e o próximo carregamento completo continuar acertando de
// primeira — não é o padrão client-only sem persistência que o protótipo tinha e que já foi
// registrado como "não portar" (docs/ui/shell-spec.md §3.3/§6.3).
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
}: SidebarLeftSlotProps) {
  const [collapsed, setCollapsed] = useState(collapsedFromServer);
  const [, startTransition] = useTransition();

  if (!enabled) return null;

  const isAdmin = navMode === "admin";

  function handleToggleCollapsed() {
    setCollapsed((value) => !value);
    startTransition(() => {
      onToggleCollapsed();
    });
  }

  return (
    <MobileNavDrawer
      asideClassName={cn(
        // px-5 é fixo em qualquer breakpoint e em qualquer estado de collapsed — a faixa de
        // largura do ícone não pode depender da largura do sidebar (bug desta sessão: padding
        // não está na lista de propriedades de ui-motion-emphasis, então px-5→px-3 trocava
        // instantaneamente enquanto a largura do <aside> ainda levava 300ms pra terminar,
        // deslocando o ícone antes do fim da transição). Só `width` anima.
        "relative flex h-full w-full flex-col px-5 py-6 text-foreground shadow-float lg:w-(--sidebar-width-expanded) lg:shrink-0 lg:border-r lg:shadow-none ui-motion-emphasis",
        isAdmin ? "border-ring bg-(image:--sidebar-bg-admin)" : "border-border bg-(image:--sidebar-bg)",
        collapsed && "lg:w-(--sidebar-width-collapsed)",
      )}
    >
      {/* z-50 (não z-10): esse botão flutua pra fora da sidebar (translate-x-1/2) sobre a coluna
          de conteúdo, onde o HeaderSlot mora — header é sticky com z-40, e com z-10 o header
          ficava por cima e cortava a seta ao meio (mesmo bug corrigido nos temas
          aurora/nebula/vega/halo/harbor — venore-slime tinha a mesma cópia, sem o fix). */}
      <div className="absolute top-4 right-0 z-50 hidden translate-x-1/2 lg:block">
        <button
          type="button"
          onClick={handleToggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
          className="flex size-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-panel ui-motion-base outline-none hover:bg-muted hover:border-ring active:border-ring focus-visible:ring-2 focus-visible:ring-ring"
        >
          {collapsed ? (
            <ChevronRight className="size-4" aria-hidden="true" />
          ) : (
            <ChevronLeft className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {canToggleAdminNav && (
        // pt-8: espaço reservado pro botão flutuante de colapso (top-4, size-11), que fica
        // sobreposto ao canto superior direito do frame — mesma folga em expandido/colapsado pra
        // não depender de cálculo fino de onde a coluna direita do pill termina.
        <div className="shrink-0 border-b border-border pt-8 pb-4">
          <SidebarSurfaceSwitch isAdmin={isAdmin} collapsed={collapsed} onToggleNavMode={onToggleNavMode} />
        </div>
      )}

      <nav
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
      </nav>
    </MobileNavDrawer>
  );
}

function SidebarSurfaceSwitch({
  isAdmin,
  collapsed,
  onToggleNavMode,
}: {
  isAdmin: boolean;
  collapsed: boolean;
  onToggleNavMode: () => Promise<void>;
}) {
  const label = isAdmin ? "Sair do admin" : "Área administrativa";

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
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-1 z-0 w-[calc(50%-0.125rem)] rounded-lg border border-ring bg-card shadow-panel ui-motion-base",
          isAdmin ? "left-[calc(50%+0.125rem)]" : "left-1",
        )}
      />
      <NavModeSegmentButton isActive={!isAdmin} icon={Globe2} text="Site" />
      <NavModeSegmentButton isActive={isAdmin} icon={ShieldCheck} text="Admin" />
      </form>
    </>
  );
}

// A troca de navMode depende de um round-trip de Server Action (cookie só é lido no próximo
// render do RootLayout — get-nav-mode.ts — então, ao contrário do colapso, não dá pra flipar a
// navegação otimisticamente no client: navItems/navGroups vêm do servidor já filtrados pelo modo
// atual). useFormStatus() (react-dom) dá o pending do <form> mais próximo de graça, sem estado
// extra — troca o ícone do botão alvo (o clicável) por um spinner e trava a interação até o
// refresh da rota devolver os dados do novo modo, pra latência de rede (notada em instâncias
// Vercel) parecer carregamento em vez de UI travada.
function NavModeIconButton({ isAdmin, label }: { isAdmin: boolean; label: string }) {
  const { pending } = useFormStatus();

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
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : isAdmin ? (
        <ShieldCheck className="size-4" aria-hidden="true" />
      ) : (
        <Globe2 className="size-4" aria-hidden="true" />
      )}
      <span className={cn("max-w-0 overflow-hidden whitespace-nowrap opacity-0", SIDEBAR_COLLAPSE_TOOLTIP_COLLAPSED_CLASSES)}>
        {label}
      </span>
    </button>
  );
}

function NavModeSegmentButton({ isActive, icon: Icon, text }: { isActive: boolean; icon: LucideIcon; text: string }) {
  const { pending } = useFormStatus();
  // O segmento inativo é o alvo do clique (o toggle sempre inverte o modo atual) — só ele vira
  // spinner; o já-ativo permanece com o próprio ícone porque não é ele que está "carregando".
  const isTarget = !isActive;

  return (
    <button
      type="submit"
      disabled={isActive || pending}
      aria-current={isActive ? true : undefined}
      aria-busy={isTarget && pending ? true : undefined}
      className={cn(
        "relative z-10 flex h-9 items-center justify-center gap-2 rounded-lg text-xs font-semibold uppercase tracking-caps ui-motion-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
        isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        isTarget && !pending && "cursor-pointer",
      )}
    >
      {isTarget && pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Icon className="size-4" aria-hidden="true" />}
      {text}
    </button>
  );
}
