import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SidebarLeftSlot } from "./SidebarLeftSlot";
import type { SidebarLeftSlotProps } from "@/contexts/themes/contracts/types";

// Mock de usePathname pra testar aria-current e o estado inicial (expandido/fechado) do accordion
// de agregador, que dependem da rota atual. Default null replica o comportamento fora do App
// Router (Next não lança, só retorna null) — cada teste que precisa de uma rota específica ajusta
// mockPathname antes de renderizar.
let mockPathname: string | null = null;
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

// SidebarLeftSlot continua um server component (docs/ui/shell-spec.md §3): o único estado que
// importa pro markup SSR é `collapsed`, já resolvido do cookie ANTES deste componente rodar (não
// há hidratação/segundo render que troque a largura — é por isso que não existe o bug de flash
// registrado no spec). SidebarNavLink usa usePathname() internamente; fora do App Router esse
// hook retorna null (Next não lança), então aria-current fica ausente por padrão — comportamento
// aceitável pra este teste, que cobre layout/largura/permissão, não roteamento.
beforeEach(() => {
  mockPathname = null;
});
const baseProps: SidebarLeftSlotProps = {
  enabled: true,
  navMode: "main",
  navItems: [
    { key: "home", label: "Home", href: "/", icon: "home", isExternal: false, opensInNewTab: false },
    { key: "academy", label: "Academy", href: "/academy", isExternal: false, opensInNewTab: false },
  ],
  navGroups: [],
  canToggleAdminNav: false,
  onToggleNavMode: async () => {},
  collapsed: false,
  onToggleCollapsed: async () => {},
};

const adminGroups: SidebarLeftSlotProps["navGroups"] = [
  {
    key: "rbac",
    label: "RBAC",
    items: [{ key: "rbac.roles", label: "Papéis e permissões", href: "/admin/rbac", icon: "users" }],
  },
];

describe("SidebarLeftSlot — estados de colapso", () => {
  it("não renderiza nada quando enabled é false", () => {
    const html = renderToStaticMarkup(<SidebarLeftSlot {...baseProps} enabled={false} />);
    expect(html).toBe("");
  });

  it("expandida: carrega a largura expandida via token e aria-expanded=true no controle de colapso", () => {
    const html = renderToStaticMarkup(<SidebarLeftSlot {...baseProps} collapsed={false} />);

    expect(html).toContain("lg:w-(--sidebar-width-expanded)");
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("Colapsar barra lateral");
  });

  it("colapsada: carrega a largura colapsada via token e aria-expanded=false no controle de colapso", () => {
    const html = renderToStaticMarkup(<SidebarLeftSlot {...baseProps} collapsed={true} />);

    expect(html).toContain("lg:w-(--sidebar-width-collapsed)");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Expandir barra lateral");
  });

  it("o controle de colapso tem alvo de toque mínimo de 44px (size-11) e só aparece em lg:", () => {
    const html = renderToStaticMarkup(<SidebarLeftSlot {...baseProps} />);

    expect(html).toContain("size-11");
    expect(html).toContain("hidden translate-x-1/2 lg:block");
  });

  it("<aside> preenche a altura inteira em qualquer breakpoint (sem override lg:h-auto) e <nav> estica/rola por conta própria", () => {
    const html = renderToStaticMarkup(<SidebarLeftSlot {...baseProps} />);

    expect(html).toContain("h-full");
    expect(html).not.toContain("lg:h-auto");
    expect(html).toContain("min-h-0 flex-1");
    expect(html).toContain("overflow-y-auto");
  });

  it("renderiza os itens de main-nav (lista plana, sem título de seção) quando navMode é 'main'", () => {
    const html = renderToStaticMarkup(<SidebarLeftSlot {...baseProps} />);

    expect(html).toContain("Home");
    expect(html).toContain("Academy");
  });

  it("renderiza os grupos de admin-nav com título de seção quando navMode é 'admin'", () => {
    const html = renderToStaticMarkup(<SidebarLeftSlot {...baseProps} navMode="admin" navGroups={adminGroups} navItems={[]} />);

    expect(html).toContain("RBAC");
    expect(html).toContain("Papéis e permissões");
  });

  it("agregador (item.href null) renderiza como botão accordion com aria-expanded/aria-controls, não como link", () => {
    const html = renderToStaticMarkup(
      <SidebarLeftSlot
        {...baseProps}
        navItems={[
          {
            key: "rh",
            label: "Recursos Humanos",
            href: null,
            children: [
              { key: "rh.item-1", label: "Item 1", href: "/rh/item-1", isExternal: false, opensInNewTab: false },
              { key: "rh.item-2", label: "Item 2", href: "/rh/item-2", isExternal: false, opensInNewTab: false },
            ],
          },
        ]}
      />,
    );

    expect(html).toContain("Recursos Humanos");
    expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*aria-controls="sidebar-nav-group-rh"/);
    // Fechado por padrão (nenhuma rota ativa entre os filhos fora do App Router) — filhos não vão pro markup.
    expect(html).not.toContain("Item 1");
  });

  it("agregador com um filho na rota atual abre por padrão (ancestral ativo) e marca aria-current no filho", () => {
    mockPathname = "/rh/item-1";

    const html = renderToStaticMarkup(
      <SidebarLeftSlot
        {...baseProps}
        navItems={[
          {
            key: "rh",
            label: "Recursos Humanos",
            href: null,
            children: [
              { key: "rh.item-1", label: "Item 1", href: "/rh/item-1", isExternal: false, opensInNewTab: false },
              { key: "rh.item-2", label: "Item 2", href: "/rh/item-2", isExternal: false, opensInNewTab: false },
            ],
          },
        ]}
      />,
    );

    expect(html).toMatch(/<button[^>]*aria-expanded="true"[^>]*data-active-ancestor="true"/);
    expect(html).toContain("Item 1");
    expect(html).toContain("Item 2");
    expect(html).toMatch(/aria-current="page"[^>]*>\s*<span/);
  });

  it("o item de nav não tem barra de destaque (border-l) nem em repouso, nem em hover/active, nem fixa (isActive)", () => {
    const html = renderToStaticMarkup(<SidebarLeftSlot {...baseProps} />);

    expect(html).not.toContain("border-l-2");
    expect(html).not.toMatch(/border-l-2[^"]*border-primary/);
  });
});

describe("SidebarLeftSlot — visibilidade do alternador Site/Admin", () => {
  it("NÃO renderiza o alternador quando canToggleAdminNav é false (sem a permissão)", () => {
    const html = renderToStaticMarkup(<SidebarLeftSlot {...baseProps} canToggleAdminNav={false} />);

    expect(html).not.toContain("Área administrativa");
    expect(html).not.toContain("Sair do admin");
  });

  it("renderiza o alternador (modo site) quando canToggleAdminNav é true e navMode é 'main'", () => {
    const html = renderToStaticMarkup(<SidebarLeftSlot {...baseProps} canToggleAdminNav={true} navMode="main" />);

    expect(html).toContain("Área administrativa");
  });

  it("renderiza o alternador (modo admin) quando canToggleAdminNav é true e navMode é 'admin'", () => {
    const html = renderToStaticMarkup(
      <SidebarLeftSlot {...baseProps} canToggleAdminNav={true} navMode="admin" navGroups={adminGroups} navItems={[]} />,
    );

    expect(html).toContain("Sair do admin");
  });

  it("continua sem renderizar o alternador mesmo colapsada, se canToggleAdminNav é false", () => {
    const html = renderToStaticMarkup(<SidebarLeftSlot {...baseProps} canToggleAdminNav={false} collapsed={true} />);

    expect(html).not.toContain("Área administrativa");
  });

  it("o alternador vem antes do <nav> no markup (não depois)", () => {
    const html = renderToStaticMarkup(<SidebarLeftSlot {...baseProps} canToggleAdminNav={true} navMode="main" />);

    const switchIndex = html.indexOf("Área administrativa");
    const navIndex = html.indexOf("data-nav-mode");
    expect(switchIndex).toBeGreaterThan(-1);
    expect(navIndex).toBeGreaterThan(-1);
    expect(switchIndex).toBeLessThan(navIndex);
  });

  it("o pill de dois segmentos some em lg: quando colapsada, mas continua no markup (off-canvas mobile ignora collapsed)", () => {
    const html = renderToStaticMarkup(
      <SidebarLeftSlot {...baseProps} canToggleAdminNav={true} navMode="main" collapsed={true} />,
    );

    expect(html).toContain("lg:hidden");
    expect(html).toContain("Área administrativa");
  });
});
