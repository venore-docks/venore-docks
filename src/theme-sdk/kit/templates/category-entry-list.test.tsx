// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ThemeEntryView } from "@/contexts/themes/contracts/v8";
import { CategoryEntryList } from "./category-entry-list";

// Scroll infinito da listagem de categoria: ao a sentinela entrar na viewport, busca o próximo lote
// e ANEXA aos cards já exibidos (sem trocar de página).

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const labels = { readMore: "Ler mais", loadingMore: "Carregando…", loadError: "Falhou", retry: "Tentar de novo" };

function entry(id: string): ThemeEntryView {
  return {
    id,
    title: `Título ${id}`,
    excerpt: null,
    path: `/noticias/${id}`,
    publishedAt: "2026-10-01T12:00:00.000Z",
    updatedAt: null,
    category: { label: "Notícias", href: "/noticias" },
    cover: null,
  };
}

let observerCallback: IntersectionObserverCallback | null = null;
let container: HTMLDivElement;
let root: Root;

class FakeObserver {
  constructor(callback: IntersectionObserverCallback) {
    observerCallback = callback;
  }
  observe() {}
  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
}

beforeEach(() => {
  observerCallback = null;
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeObserver;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function render(hasNext: boolean, typeKey: string | null = null) {
  act(() =>
    root.render(
      <CategoryEntryList
        categorySlug="noticias"
        typeKey={typeKey}
        initialEntries={[entry("a"), entry("b")]}
        initialPage={1}
        initialHasNext={hasNext}
        locale="pt-BR"
        labels={labels}
        fallbackNav={null}
      />,
    ),
  );
}

async function intersect() {
  await act(async () => {
    observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
  });
}

describe("CategoryEntryList", () => {
  it("anexa o próximo lote aos cards já exibidos quando a sentinela aparece", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ entries: [entry("c"), entry("a")], hasNextPage: false }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(true);
    expect(container.querySelectorAll("article")).toHaveLength(2);

    await intersect();

    expect(fetchMock).toHaveBeenCalledWith("/api/category-entries?category=noticias&page=2", expect.anything());
    // a (já exibida) não duplica; c entra; os dois primeiros continuam lá.
    expect(container.querySelectorAll("article")).toHaveLength(3);
    expect(container.textContent).toContain("Título a");
    expect(container.textContent).toContain("Título c");
  });

  it("com tipo ativo, repassa ?tipo= ao endpoint dos próximos lotes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entries: [], hasNextPage: false }) });
    vi.stubGlobal("fetch", fetchMock);
    render(true, "campanhas");
    await intersect();
    expect(fetchMock).toHaveBeenCalledWith("/api/category-entries?category=noticias&page=2&tipo=campanhas", expect.anything());
  });

  it("sem próxima página não observa nem busca", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(false);
    expect(observerCallback).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falha na busca mostra o erro com 'tentar de novo' e mantém os cards", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    render(true);
    await intersect();
    expect(container.textContent).toContain("Falhou");
    expect(container.textContent).toContain("Tentar de novo");
    expect(container.querySelectorAll("article")).toHaveLength(2);
  });
});
