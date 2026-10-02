import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/cms", () => ({ extractEntryComposition: () => null }));
vi.mock("@/platform/brand/get-brand-config", () => ({ getBrandConfig: async () => ({ siteName: "Site", footerDescription: null }) }));
vi.mock("@/platform/seo/entry-excerpt", () => ({ extractExcerpt: () => "" }));
vi.mock("@/platform/seo/public-content", () => ({ listPublicEntryLinks: async () => ({ entries: [], categories: [] }) }));
vi.mock("@/platform/seo/site-origin", () => ({ getSiteOrigin: async () => "https://example.test" }));
vi.mock("@/platform/theme-rendering/resolve-document-locale", () => ({ resolveDocumentLocale: async () => ({ locale: "ar", dir: "rtl" }) }));

const { GET } = await import("./route");

describe("GET /rss.xml", () => {
  it("<language> segue o locale do site", async () => {
    const xml = await (await GET(new Request("https://example.test/rss.xml"))).text();
    expect(xml).toContain("<language>ar</language>");
    expect(xml).not.toContain("pt-BR");
  });
});
