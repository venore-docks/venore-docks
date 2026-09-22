import { describe, expect, it } from "vitest";
import type { ResolvedMenuItem } from "@/contexts/cms";
import { toSitemapItems } from "./to-sitemap-items";

describe("toSitemapItems", () => {
  it("mounts the sitemap tree from the menu, first level as columns and children as links", () => {
    const menu: ResolvedMenuItem[] = [
      {
        id: "col-1",
        label: "Institucional",
        href: null,
        isExternal: false,
        opensInNewTab: false,
        icon: null,
        children: [
          { id: "item-1", label: "Sobre", href: "/sobre", isExternal: false, opensInNewTab: false, icon: null, children: [] },
          { id: "item-2", label: "Contato", href: "/contato", isExternal: false, opensInNewTab: false, icon: null, children: [] },
        ],
      },
    ];

    expect(toSitemapItems(menu)).toEqual([
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
    ]);
  });

  it("keeps a linkless item (href null) as a non-clickable group header, not dropped", () => {
    const menu: ResolvedMenuItem[] = [
      {
        id: "col-1",
        label: "Recursos",
        href: null,
        isExternal: false,
        opensInNewTab: false,
        icon: null,
        children: [{ id: "item-1", label: "Blog", href: "/blog", isExternal: false, opensInNewTab: false, icon: null, children: [] }],
      },
    ];

    const result = toSitemapItems(menu);

    expect(result[0]?.href).toBeNull();
    expect(result[0]?.children).toHaveLength(1);
  });

  it("returns an empty array when there is no menu configured for the sitemap location", () => {
    expect(toSitemapItems([])).toEqual([]);
  });

  it("never includes a menu item pointing at unpublished content, because contexts/cms already filtered it out upstream", () => {
    // resolvePublicMenuTree (contexts/cms/menu-resolution.ts) drops a "content" item whose entry
    // isn't published before this function ever runs — it never reaches ResolvedMenuItem. This
    // test documents that toSitemapItems has no filtering logic of its own to re-derive: what
    // comes in is what goes out, reshaped.
    const menuWithoutTheUnpublishedItem: ResolvedMenuItem[] = [
      { id: "item-1", label: "Publicado", href: "/publicado", isExternal: false, opensInNewTab: false, icon: null, children: [] },
    ];

    expect(toSitemapItems(menuWithoutTheUnpublishedItem)).toEqual([
      { key: "item-1", label: "Publicado", href: "/publicado", isExternal: false, opensInNewTab: false, children: [] },
    ]);
  });

  it("resolves opensInNewTab true for an external link even when the raw target flag was never set", () => {
    const menu: ResolvedMenuItem[] = [
      { id: "item-1", label: "Parceiro", href: "https://parceiro.com", isExternal: true, opensInNewTab: true, icon: null, children: [] },
    ];

    expect(toSitemapItems(menu)[0]?.opensInNewTab).toBe(true);
  });
});
