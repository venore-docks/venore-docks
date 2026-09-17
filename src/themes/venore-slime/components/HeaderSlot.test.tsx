import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HeaderSlot } from "./HeaderSlot";
import type { HeaderSlotProps } from "@/contexts/themes/contracts/types";

// HeaderSlot é server component puro (sem I/O) — renderToStaticMarkup sem jsdom/testing-library
// (nenhum instalado; vitest roda em environment "node"). O header reativo ao scroll não guarda
// `isScrolled` como prop/estado React: os dois estados ("top"/"scrolled") coexistem no mesmo
// markup, alternados por `data-scrolled` no <header> (escrito por HeaderScrollSentinel) via
// seletores CSS `data-[scrolled=true]:`. "Cobrir os dois estados" = um render prova que as
// classes de AMBOS estão presentes.
//
// Refator premium: o estado "scrolled" ELEVA o header (frosted + sombra + encolhe), não inverte
// a paleta pra bg-primary. Sem mais classes `group-data-[scrolled=true]/header:...primary...`.
const baseProps: HeaderSlotProps = {
  brand: {
    name: "Venore Docks",
    mode: "svg",
    size: 100,
    scrolledSize: 90,
    position: "left",
    logoUrl: "/brand/brand-logo.svg",
    scrolledLogoUrl: "/brand/brand-logo-scrolled.png",
  },
  userbarEnabled: true,
  stickyEnabled: true,
  scrollShrinkEnabled: true,
  headerNavItems: [{ key: "home", label: "Home", href: "/" }],
  user: null,
  canAccessAdmin: false,
  onSignOut: async () => {},
  showLoginLink: true,
};

describe("HeaderSlot — máquina de estados de scroll", () => {
  it("monta o <header> no estado 'top' por padrão, antes de qualquer detecção de scroll", () => {
    const html = renderToStaticMarkup(<HeaderSlot {...baseProps} />);

    expect(html).toContain('id="site-header"');
    expect(html).toContain('data-scrolled="false"');
  });

  it("carrega no markup as classes do estado 'top' (bg-card, borda hairline, altura base)", () => {
    const html = renderToStaticMarkup(<HeaderSlot {...baseProps} />);

    expect(html).toContain("bg-card");
    expect(html).toContain("border-header-border-subtle");
    expect(html).toContain("h-20");
    expect(html).toContain("lg:h-24");
  });

  it("com stickyEnabled, o header top já fica levemente fosco (backdrop-blur)", () => {
    const html = renderToStaticMarkup(<HeaderSlot {...baseProps} />);

    expect(html).toContain("sticky");
    expect(html).toContain("backdrop-blur-sm");
  });

  it("carrega no mesmo markup as classes do estado 'scrolled' (eleva: frosted + sombra + encolhe), prontas pra ativar via CSS quando data-scrolled virar true", () => {
    const html = renderToStaticMarkup(<HeaderSlot {...baseProps} />);

    expect(html).toContain("data-[scrolled=true]:h-16");
    expect(html).toContain("data-[scrolled=true]:bg-card/85");
    expect(html).toContain("data-[scrolled=true]:backdrop-blur-xl");
    expect(html).toContain("data-[scrolled=true]:border-border");
    expect(html).toContain("data-[scrolled=true]:shadow-header");
  });

  it("NÃO inverte a paleta no scroll (sem bg-primary / text-primary-foreground no header)", () => {
    const html = renderToStaticMarkup(<HeaderSlot {...baseProps} />);

    expect(html).not.toContain("data-[scrolled=true]:bg-primary");
    expect(html).not.toContain("group-data-[scrolled=true]/header:text-primary-foreground");
  });

  it("renderiza a sentinela de scroll sem reservar espaço no fluxo (zero layout shift)", () => {
    const html = renderToStaticMarkup(<HeaderSlot {...baseProps} />);

    expect(html).toContain("aria-hidden");
    expect(html).toContain("h-0");
  });

  it("sem usuário, mostra o link 'Entrar'", () => {
    const html = renderToStaticMarkup(<HeaderSlot {...baseProps} />);

    expect(html).toContain("text-muted-foreground");
    expect(html).toContain("Entrar");
  });

  it("com usuário logado, troca o link 'Entrar' pelo UserMenu", () => {
    const html = renderToStaticMarkup(
      <HeaderSlot
        {...baseProps}
        user={{ displayName: "Ada Lovelace", email: "ada@example.com", imageUrl: null }}
      />,
    );

    expect(html).not.toContain("Entrar");
    expect(html).toContain("Ada Lovelace");
  });

  it("com showLoginLink=false, esconde o link 'Entrar' sem exigir usuário logado (nav.hideLoginLink)", () => {
    const html = renderToStaticMarkup(<HeaderSlot {...baseProps} showLoginLink={false} />);

    expect(html).not.toContain("Entrar");
  });

  it("T4: com stickyEnabled=false, não aplica sticky/top-0 nem backdrop-blur no estado top", () => {
    const html = renderToStaticMarkup(<HeaderSlot {...baseProps} stickyEnabled={false} />);

    expect(html).not.toContain("sticky");
    expect(html).not.toContain("backdrop-blur-sm");
  });

  it("T4: com scrollShrinkEnabled=false, não monta HeaderScrollSentinel nem carrega as classes data-[scrolled=true]", () => {
    const html = renderToStaticMarkup(<HeaderSlot {...baseProps} scrollShrinkEnabled={false} />);

    expect(html).not.toContain("data-[scrolled=true]:h-16");
    expect(html).not.toContain("h-0 w-0 overflow-visible");
  });
});
