// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { CategoryTemplateProps } from "@/contexts/themes/contracts/v8";
import { KitCategoryTemplate } from "./category-template";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("./category-entry-list", () => ({
  CategoryEntryList: ({ typeKey }: { typeKey?: string | null }) => <div data-testid="list" data-type={typeKey ?? ""} />,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const entry = { id: "e1", title: "Uma", excerpt: null, path: "/noticias/uma", publishedAt: null, updatedAt: null, category: null, cover: null };

function props(typeFilter: CategoryTemplateProps["typeFilter"]): CategoryTemplateProps {
  return {
    category: { label: "Notícias", description: null, path: "/noticias", rssPath: "/rss.xml?category=noticias" },
    entries: [entry],
    pagination: { page: 1, pageCount: 1, prevHref: null, nextHref: null },
    sort: { current: "recent", options: [] },
    typeFilter,
    empty: null,
    jsonLd: null,
    outlets: { before: null, after: null },
    locale: "pt-BR",
  } as unknown as CategoryTemplateProps;
}

const filter = {
  typeKey: "campanhas",
  allHref: "/noticias",
  options: [
    { key: "campanhas", label: "Campanhas", count: 18, href: "/noticias?tipo=campanhas", active: true },
    { key: "noticias-da-fem", label: "Notícias da FEM", count: 6, href: "/noticias?tipo=noticias-da-fem", active: false },
  ],
};

describe("KitCategoryTemplate — filtro por tipo", () => {
  it("renderiza 'Todas' + um chip por tipo como links reais, com o ativo marcado", () => {
    act(() => root.render(<KitCategoryTemplate {...props(filter)} />));
    const links = [...container.querySelectorAll("nav a")] as HTMLAnchorElement[];
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/noticias", "/noticias?tipo=campanhas", "/noticias?tipo=noticias-da-fem"]);
    expect(links.map((a) => a.getAttribute("aria-current"))).toEqual([null, "page", null]);
    expect(container.textContent).toContain("Campanhas");
    expect(container.textContent).toContain("18");
  });

  it("'Todas' fica ativo quando nenhum tipo está selecionado", () => {
    act(() => root.render(<KitCategoryTemplate {...props({ ...filter, typeKey: null, options: filter.options.map((o) => ({ ...o, active: false })) })} />));
    const links = [...container.querySelectorAll("nav a")] as HTMLAnchorElement[];
    expect(links[0].getAttribute("aria-current")).toBe("page");
  });

  it("repassa o tipo ativo para a lista (rolagem infinita)", () => {
    act(() => root.render(<KitCategoryTemplate {...props(filter)} />));
    expect(container.querySelector("[data-testid=list]")?.getAttribute("data-type")).toBe("campanhas");
  });

  it("sem typeFilter não desenha chips", () => {
    act(() => root.render(<KitCategoryTemplate {...props(null)} />));
    expect(container.querySelector("nav")).toBeNull();
  });
});
