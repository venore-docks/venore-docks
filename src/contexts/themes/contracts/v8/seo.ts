// SEO declarado pelo tema (spec §2.2 / §7.7).
export type ThemeSeoDeclaration = {
  themeColor?: "from-tokens" | { light: string; dark: string }; // hex
  structuredData?: {
    entry?: "Article" | "BlogPosting" | "WebPage";
    category?: "CollectionPage" | "Blog";
    home?: "WebSite" | "Organization";
  };
};
