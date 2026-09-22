import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Sitemap } from "./sitemap";
import type { SitemapItem } from "@/contexts/themes";

describe("Sitemap", () => {
  it("mounts columns from the menu, first level as headings and children as links", () => {
    const items: SitemapItem[] = [
      {
        key: "col-1",
        label: "Institucional",
        href: null,
        isExternal: false,
        opensInNewTab: false,
        children: [
          { key: "item-1", label: "Sobre", href: "/sobre", isExternal: false, opensInNewTab: false, children: [] },
          { key: "item-2", label: "Contato", href: "/contato", isExternal: false, opensInNewTab: false, children: [] },
        ],
      },
    ];

    const html = renderToStaticMarkup(<Sitemap items={items} />);

    expect(html).toContain("Institucional");
    expect(html).toContain('href="/sobre"');
    expect(html).toContain("Sobre");
    expect(html).toContain('href="/contato"');
    expect(html).toContain("Contato");
  });

  it("renders a linkless item (href null) as a non-clickable group header, not as an anchor", () => {
    const items: SitemapItem[] = [
      {
        key: "col-1",
        label: "Recursos",
        href: null,
        isExternal: false,
        opensInNewTab: false,
        children: [{ key: "item-1", label: "Blog", href: "/blog", isExternal: false, opensInNewTab: false, children: [] }],
      },
    ];

    const html = renderToStaticMarkup(<Sitemap items={items} />);

    // O rótulo do cabeçalho não deve virar <a>/<Link> — só o filho com href deve.
    expect(html).not.toMatch(/<a[^>]*>Recursos<\/a>/);
    expect(html).toContain("Recursos");
    expect(html).toMatch(/<a[^>]*href="\/blog"[^>]*>Blog<\/a>/);
  });

  it("renders nothing when there is no sitemap menu configured (empty items)", () => {
    const html = renderToStaticMarkup(<Sitemap items={[]} />);

    expect(html).toBe("");
  });

  it("gives an external item target=_blank and rel=noopener noreferrer", () => {
    const items: SitemapItem[] = [
      {
        key: "col-1",
        label: "Parceiros",
        href: null,
        isExternal: false,
        opensInNewTab: false,
        children: [
          {
            key: "item-1",
            label: "Site parceiro",
            href: "https://parceiro.example",
            isExternal: true,
            opensInNewTab: true,
            children: [],
          },
        ],
      },
    ];

    const html = renderToStaticMarkup(<Sitemap items={items} />);

    expect(html).toContain('href="https://parceiro.example"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("does not give an internal item target=_blank/rel by default", () => {
    const items: SitemapItem[] = [
      {
        key: "col-1",
        label: "Institucional",
        href: null,
        isExternal: false,
        opensInNewTab: false,
        children: [{ key: "item-1", label: "Sobre", href: "/sobre", isExternal: false, opensInNewTab: false, children: [] }],
      },
    ];

    const html = renderToStaticMarkup(<Sitemap items={items} />);

    expect(html).not.toContain("target=");
    expect(html).not.toContain("rel=");
  });

  it("gives an internal item target=_blank/rel when opensInNewTab is set (editor opt-in)", () => {
    const items: SitemapItem[] = [
      {
        key: "col-1",
        label: "Institucional",
        href: null,
        isExternal: false,
        opensInNewTab: false,
        children: [
          { key: "item-1", label: "Sobre", href: "/sobre", isExternal: false, opensInNewTab: true, children: [] },
        ],
      },
    ];

    const html = renderToStaticMarkup(<Sitemap items={items} />);

    expect(html).toContain('href="/sobre"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("renders both the desktop column grid and the mobile accordion (details/summary) in the same markup", () => {
    const items: SitemapItem[] = [
      {
        key: "col-1",
        label: "Institucional",
        href: null,
        isExternal: false,
        opensInNewTab: false,
        children: [{ key: "item-1", label: "Sobre", href: "/sobre", isExternal: false, opensInNewTab: false, children: [] }],
      },
    ];

    const html = renderToStaticMarkup(<Sitemap items={items} />);

    expect(html).toContain("sm:grid");
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).toContain("sm:hidden");
  });
});
