// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { SidebarLeftSlotProps } from "@/contexts/themes/contracts/types";
import { getScrollLockCount, lockScroll, useScrollLock } from "./use-scroll-lock";
import { useOverlay } from "./use-overlay";
import { useHeaderScrollState } from "./use-header-scroll-state";
import { resetSidebarCollapseStore } from "../stores/sidebar-collapse-store";
import { closeMobileNav } from "../stores/mobile-nav-store";
import { SidebarCollapseButton } from "../regions/site-header/sidebar-collapse-button";
import { MobileNavToggleButton } from "../regions/site-header/mobile-nav-toggle-button";
import { SidebarLeftSlot } from "../regions/rail/rail";
import { MobileNavOverlay } from "../regions/mobile-nav/mobile-nav-overlay";
import { MobileBottomBar } from "../regions/mobile-nav/mobile-bottom-bar";

// Hooks e stores client do kit (spec v8 §7.8) em jsdom: trava de scroll ref-contada, armadilha de
// foco com devolução ao gatilho, store de colapso compartilhado entre header e rail, estado de
// scroll do header por IntersectionObserver.

let mockPathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => mockPathname }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  mockPathname = "/";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  window.matchMedia = vi.fn(() => ({ matches: false })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  act(() => closeMobileNav());
  resetSidebarCollapseStore();
  document.body.removeAttribute("style");
});

function render(node: React.ReactNode) {
  act(() => root.render(node));
}

function press(key: string, init: KeyboardEventInit = {}) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...init }));
  });
}

describe("useScrollLock — contagem de referência", () => {
  it("duas travas: soltar a primeira mantém o body fixo; só a última restaura", () => {
    Object.defineProperty(window, "scrollY", { value: 240, configurable: true });
    const releaseA = lockScroll();
    const releaseB = lockScroll();
    expect(getScrollLockCount()).toBe(2);
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe("-240px");

    releaseA();
    releaseA(); // idempotente: não desconta duas vezes
    expect(getScrollLockCount()).toBe(1);
    expect(document.body.style.position).toBe("fixed");
    expect(window.scrollTo).not.toHaveBeenCalled();

    releaseB();
    expect(getScrollLockCount()).toBe(0);
    expect(document.body.style.position).toBe("");
    expect(document.body.style.top).toBe("");
    expect(window.scrollTo).toHaveBeenCalledWith(0, 240);
  });

  it("duas camadas reais abertas (drawer + folha Mais): fechar uma não destrava o scroll da outra", () => {
    render(
      <>
        <MobileNavToggleButton />
        <MobileNavOverlay variant="drawer">
          <a href="#a">A</a>
        </MobileNavOverlay>
        <MobileBottomBar items={[{ key: "h", label: "Home", href: "/" }]} more={<a href="#x">X</a>} />
      </>,
    );
    const toggle = container.querySelector<HTMLButtonElement>('button[aria-label="Abrir navegação"]')!;
    act(() => toggle.click());
    const more = container.querySelector<HTMLButtonElement>('button[aria-controls="kit-mobile-more"]')!;
    act(() => more.click());
    expect(getScrollLockCount()).toBe(2);

    act(() => more.click()); // fecha a folha
    expect(getScrollLockCount()).toBe(1);
    expect(document.body.style.position).toBe("fixed");

    act(() => closeMobileNav());
    expect(getScrollLockCount()).toBe(0);
    expect(document.body.style.position).toBe("");
  });

  it("o hook trava enquanto ativo e solta no unmount", () => {
    function Lock({ on }: { on: boolean }) {
      useScrollLock(on);
      return null;
    }
    render(<Lock on />);
    expect(getScrollLockCount()).toBe(1);
    render(<Lock on={false} />);
    expect(getScrollLockCount()).toBe(0);
  });
});

describe("useOverlay — armadilha de foco e devolução", () => {
  function Harness({ trap = true }: { trap?: boolean }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useOverlay({ open, onClose: () => setOpen(false), containerRef: ref, trapFocus: trap });
    return (
      <>
        <button type="button" id="trigger" onClick={() => setOpen(true)}>
          abrir
        </button>
        <div ref={ref} hidden={!open}>
          <a href="#1" id="first">
            1
          </a>
          <a href="#2" id="last">
            2
          </a>
        </div>
      </>
    );
  }

  it("foca o primeiro ao abrir, circula no Tab e devolve o foco ao gatilho no Escape", () => {
    render(<Harness />);
    const trigger = container.querySelector<HTMLButtonElement>("#trigger")!;
    trigger.focus();
    act(() => trigger.click());
    expect(document.activeElement?.id).toBe("first");

    container.querySelector<HTMLElement>("#last")!.focus();
    press("Tab");
    expect(document.activeElement?.id).toBe("first");
    press("Tab", { shiftKey: true });
    expect(document.activeElement?.id).toBe("last");

    press("Escape");
    expect(container.querySelector("div")!.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it("fecha quando a rota muda", () => {
    render(<Harness />);
    act(() => container.querySelector<HTMLButtonElement>("#trigger")!.click());
    expect(container.querySelector("div")!.hidden).toBe(false);
    mockPathname = "/outra";
    render(<Harness />);
    expect(container.querySelector("div")!.hidden).toBe(true);
  });

  it("sem armadilha (ex.: drawer em lg+): não move o foco", () => {
    render(<Harness trap={false} />);
    const trigger = container.querySelector<HTMLButtonElement>("#trigger")!;
    trigger.focus();
    act(() => trigger.click());
    expect(document.activeElement).toBe(trigger);
  });

  it("camada real (tela cheia): hambúrguer abre, foco entra; Escape fecha e devolve ao hambúrguer", () => {
    render(
      <>
        <MobileNavToggleButton />
        <MobileNavOverlay variant="fullscreen">
          <a href="#a" id="item">
            A
          </a>
        </MobileNavOverlay>
      </>,
    );
    const toggle = container.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')!;
    const panel = container.querySelector<HTMLElement>("#kit-mobile-nav")!;
    expect(panel.hidden).toBe(true);
    toggle.focus();
    act(() => toggle.click());
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(panel.hidden).toBe(false);
    expect(panel.contains(document.activeElement)).toBe(true);

    press("Escape");
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).toBe(toggle);
    expect(getScrollLockCount()).toBe(0);
  });
});

describe("store de colapso compartilhado", () => {
  const rail: SidebarLeftSlotProps = {
    enabled: true,
    navMode: "main",
    navItems: [{ key: "home", label: "Home", href: "/", icon: "home" }],
    navGroups: [],
    canToggleAdminNav: false,
    onToggleNavMode: async () => {},
    collapsed: false,
    onToggleCollapsed: async () => {},
  };

  it("o botão do header e a rail leem o MESMO estado; a Server Action só persiste", () => {
    const onToggleCollapsed = vi.fn(async () => {});
    render(
      <>
        <SidebarCollapseButton collapsed={false} onToggleCollapsed={onToggleCollapsed} />
        <SidebarLeftSlot {...rail} collapseControl="header" onToggleCollapsed={onToggleCollapsed} />
      </>,
    );
    const aside = container.querySelector("aside")!;
    const button = container.querySelector<HTMLButtonElement>('[data-sidebar-collapse="header"]')!;
    // collapseControl="header": a rail não tem botão próprio.
    expect(container.querySelectorAll('button[aria-label="Colapsar barra lateral"]')).toHaveLength(1);
    expect(aside.className).not.toContain("lg:w-(--sidebar-width-collapsed)");

    act(() => button.click());
    expect(aside.className).toContain("lg:w-(--sidebar-width-collapsed)");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it("dois botões (rail e header) ficam sincronizados", () => {
    render(
      <>
        <SidebarCollapseButton collapsed={false} onToggleCollapsed={async () => {}} />
        <SidebarLeftSlot {...rail} collapseControl="rail" />
      </>,
    );
    const [headerButton, railButton] = Array.from(container.querySelectorAll<HTMLButtonElement>('button[aria-label="Colapsar barra lateral"]'));
    act(() => railButton.click());
    expect(headerButton.getAttribute("aria-expanded")).toBe("false");
    expect(railButton.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("useHeaderScrollState", () => {
  it("escreve data-scrolled no #site-header a partir das sentinelas (histerese)", () => {
    const observers: { cb: IntersectionObserverCallback; target?: Element }[] = [];
    class FakeObserver {
      cb: IntersectionObserverCallback;
      constructor(cb: IntersectionObserverCallback) {
        this.cb = cb;
      }
      observe(target: Element) {
        observers.push({ cb: this.cb, target });
      }
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });

    function Sentinel() {
      const enterRef = useRef<HTMLSpanElement>(null);
      const exitRef = useRef<HTMLSpanElement>(null);
      useHeaderScrollState({ enterRef, exitRef, enterThresholdPx: 96 });
      return (
        <>
          <span ref={enterRef} />
          <span ref={exitRef} />
        </>
      );
    }
    render(
      <>
        <Sentinel />
        <header id="site-header" data-scrolled="false" />
      </>,
    );
    const header = container.querySelector("header")!;
    const [enter, exit] = observers;
    const fire = (o: (typeof observers)[number], isIntersecting: boolean) =>
      act(() => o.cb([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver));

    fire(enter, false);
    expect(header.dataset.scrolled).toBe("true");
    fire(exit, false); // banda morta: continua "scrolled"
    expect(header.dataset.scrolled).toBe("true");
    fire(exit, true);
    expect(header.dataset.scrolled).toBe("false");
    vi.unstubAllGlobals();
  });
});
