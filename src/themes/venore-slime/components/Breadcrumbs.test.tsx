import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Breadcrumbs } from "./Breadcrumbs";
import type { BreadcrumbItem } from "@/contexts/themes/contracts/types";

const deepTrail: BreadcrumbItem[] = [
  { key: "home", label: "Início", href: "/", current: false },
  { key: "admin", label: "Dashboard", href: "/admin", current: false },
  { key: "admin.academy", label: "Academy", href: "/admin/academy", current: false },
  { key: "admin.academy.courses", label: "Cursos", href: "/admin/academy/courses", current: false },
  { key: "admin.academy.course", label: "Curso de React", href: "/admin/academy/courses/course-1", current: false },
  { key: "admin.academy.lesson", label: "Aula 1", href: null, current: true },
];

describe("Breadcrumbs — semântica e navegação", () => {
  it("não renderiza nada quando a trilha está vazia", () => {
    const html = renderToStaticMarkup(<Breadcrumbs breadcrumbs={[]} breadcrumbsJsonLd={null} />);
    expect(html).toBe("");
  });

  it("usa <nav aria-label> + lista ordenada (semântica de navegação)", () => {
    const html = renderToStaticMarkup(<Breadcrumbs breadcrumbs={deepTrail} breadcrumbsJsonLd={null} />);

    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toMatch(/<nav[^>]*aria-label="Breadcrumb"[^>]*>[\s\S]*<ol/);
  });

  it("item atual: aria-current=page, sem link, e os demais são links", () => {
    const html = renderToStaticMarkup(<Breadcrumbs breadcrumbs={deepTrail} breadcrumbsJsonLd={null} />);

    expect(html).toMatch(/aria-current="page"[^>]*>Aula 1</);
    // O rótulo do item atual não pode estar dentro de um <a>.
    expect(html).not.toMatch(/<a[^>]*>Aula 1<\/a>/);
    // Um item anterior clicável vira link de verdade (next/link renderiza `class` antes de
    // `href` no SSR, por isso o regex não fixa a ordem dos atributos).
    expect(html).toMatch(/<a[^>]*href="\/admin\/academy\/courses"[^>]*>Cursos<\/a>/);
  });

  it("item sem página correspondente (href null) não é link, mesmo não sendo o último", () => {
    const trailWithNonClickable: BreadcrumbItem[] = [
      { key: "home", label: "Início", href: "/", current: false },
      { key: "admin.cms.entries.new", label: "Novo conteúdo", href: null, current: false },
      { key: "current", label: "Rascunho", href: null, current: true },
    ];
    const html = renderToStaticMarkup(<Breadcrumbs breadcrumbs={trailWithNonClickable} breadcrumbsJsonLd={null} />);

    expect(html).not.toMatch(/<a[^>]*>Novo conteúdo<\/a>/);
    expect(html).toContain("Novo conteúdo");
  });

  it("colapso mobile: primeiro e último item ficam visíveis por padrão; itens do meio só a partir de sm:", () => {
    const html = renderToStaticMarkup(<Breadcrumbs breadcrumbs={deepTrail} breadcrumbsJsonLd={null} />);

    // Todo item continua na árvore/HTML (acessibilidade não perde nenhum nível — só o CSS
    // esconde visualmente no mobile), o teste de colapso é sobre a CLASSE do PRÓPRIO <li>, não
    // ausência do conteúdo (o <li> do primeiro item também aninha o "…" decorativo, que tem a sua
    // própria classe "sm:hidden" — por isso a extração abaixo lê só a tag de abertura de cada
    // <li>, nunca o bloco inteiro, senão essa classe aninhada contaminaria a asserção).
    for (const item of deepTrail) {
      expect(html).toContain(item.label);
    }

    const liOpenTags = [...html.matchAll(/<li class="([^"]*)"/g)].map((match) => match[1]);
    expect(liOpenTags).toHaveLength(deepTrail.length);

    const [first, , ...rest] = liOpenTags;
    const last = rest.at(-1)!;
    const middle = rest.slice(0, -1);

    expect(first).not.toMatch(/\bhidden\b/);
    expect(last).not.toMatch(/\bhidden\b/);
    for (const middleClass of middle) {
      expect(middleClass).toMatch(/\bhidden sm:flex\b/);
    }
  });

  it("com só 2 itens, não há nada pra colapsar (nenhum item ganha a classe hidden)", () => {
    const shortTrail: BreadcrumbItem[] = [
      { key: "home", label: "Início", href: "/", current: false },
      { key: "account", label: "Minha conta", href: null, current: true },
    ];
    const html = renderToStaticMarkup(<Breadcrumbs breadcrumbs={shortTrail} breadcrumbsJsonLd={null} />);

    expect(html).not.toContain("hidden sm:flex");
  });
});

describe("Breadcrumbs — dados estruturados", () => {
  it("serializa o BreadcrumbList recebido dentro de um <script type=\"application/ld+json\">", () => {
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [{ "@type": "ListItem", position: 1, name: "Início", item: "https://app.test/" }],
    };
    const html = renderToStaticMarkup(<Breadcrumbs breadcrumbs={deepTrail} breadcrumbsJsonLd={jsonLd} />);

    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain("BreadcrumbList");
    expect(html).toContain("https://app.test/");
  });

  it("sem jsonLd (null), não renderiza nenhuma tag <script>", () => {
    const html = renderToStaticMarkup(<Breadcrumbs breadcrumbs={deepTrail} breadcrumbsJsonLd={null} />);
    expect(html).not.toContain("<script");
  });

  it("não deixa um rótulo com </script> fechar a tag do JSON-LD (XSS armazenado)", () => {
    const evil = "</script><script>alert(document.domain)</script>";
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [{ "@type": "ListItem", position: 1, name: evil, item: "https://app.test/" }],
    };
    const html = renderToStaticMarkup(<Breadcrumbs breadcrumbs={deepTrail} breadcrumbsJsonLd={jsonLd} />);

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("\\u003c/script");
  });
});

