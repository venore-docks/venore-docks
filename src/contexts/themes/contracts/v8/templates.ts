import type { ComponentType, ReactNode } from "react";
import type { HeaderBrand } from "../types";
import type { RegionCommon } from "./regions";

// Templates de página (spec §2.7). O dado é resolvido pela página do core; o template só desenha.
export type MediaView = { url: string; alt: string; width?: number; height?: number };
export type ThemeEntryView = {
  id: string;
  title: string;
  excerpt: string | null;
  path: string;
  publishedAt: string | null;
  updatedAt: string | null;
  category: { label: string; href: string } | null;
  cover: MediaView | null;
};
export type TemplateCommon = RegionCommon & {
  jsonLd: ReactNode; // <script nonce> do core via serializeJsonLd
  outlets: { before: ReactNode; after: ReactNode };
};
export type HomeTemplateProps = TemplateCommon & {
  entry: ThemeEntryView | null;
  content: ReactNode | null;
  showcase: ReactNode | null;
  adminShortcuts: { href: string; label: string; icon?: "settings" }[];
  // Painel sem entry "home": nome do site e ação principal (ex.: "Ver como aluno"). Opcionais.
  siteName?: string;
  primaryAction?: { href: string; label: string } | null;
};
export type EntryTemplateProps = TemplateCommon & {
  entry: ThemeEntryView;
  content: ReactNode;
  backLink: { href: string; label: string } | null;
  firstBlockIsHero: boolean;
};
export type CategoryTemplateProps = TemplateCommon & {
  category: { label: string; description: string | null; path: string; rssPath: string };
  entries: ThemeEntryView[];
  pagination: { page: number; pageCount: number; prevHref: string | null; nextHref: string | null };
  sort: { current: "recent" | "oldest"; options: { value: "recent" | "oldest"; label: string; href: string }[] };
  empty: ReactNode;
};
export type AccountTemplateProps = TemplateCommon & { title: string; subtitle?: string | null; sections: ReactNode };
export type LoginTemplateProps = TemplateCommon & { brand: HeaderBrand; form: ReactNode; footer: ReactNode };
export type NotFoundTemplateProps = TemplateCommon & { homeHref: string };
export type TemplatePropsByKey = {
  home: HomeTemplateProps;
  entry: EntryTemplateProps;
  category: CategoryTemplateProps;
  account: AccountTemplateProps;
  login: LoginTemplateProps;
  notFound: NotFoundTemplateProps;
};
// Componente único ou mapa de variantes ("default" | valor de templateVariants).
export type Tpl<P> = ComponentType<P> | Readonly<Record<string, ComponentType<P>>>;
export type ThemeTemplates = Partial<{ [K in keyof TemplatePropsByKey]: Tpl<TemplatePropsByKey[K]> }>;
