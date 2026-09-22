import type { MainNavItem, SitemapItem } from "@/contexts/themes";

// Valores de slot que NÃO vêm de contexts/settings, CMS, auth nem do manifesto do tema — são
// constantes de plataforma. Antes chegavam via `...venoreSlimeMockProps` (o mock do tema Venore
// Slime) espalhado como base de TODO tema em resolve-theme-slot-props.ts, o que fazia qualquer
// tema não-Slime herdar as constantes do mock do Slime. Aqui ficam explícitas e neutras de tema.
export const THEME_SLOT_DEFAULTS = {
  // O Header sempre monta a user-bar (login / menu do usuário) — não há tema hoje que a dispense
  // e não é decisão editável. Se algum dia for, vira manifest.capabilities.
  userbarEnabled: true,
  // header-nav própria do Header: sem fonte real ainda (Known Gap, AGENTS.md §7) — lista vazia.
  headerNavItems: [] as const,
  // Créditos no rodapé ("feito com…"): desligado por padrão, sem toggle de admin hoje.
  footerCreditsEnabled: false,
  // SidebarLeft sempre existe (é navegação, não área de widget) — nenhum tema a dispensa hoje.
  sidebarLeftEnabled: true,
} as const;

// Exemplo mínimo de navegação, usado quando o CMS ainda não tem menu configurado pra aquele
// location (instalação nova) OU a leitura falha — sem isso a sidebar mostra "—" e o rodapé fica
// só com a marca solta, e o layout parece quebrado. Só rotas que existem no core vanilla
// (`/`, `/login`), pra nenhum link cair em 404. O admin configura os menus reais em
// /admin/cms/menus (a partir daí o CMS manda e estes deixam de aparecer).
export const FALLBACK_MAIN_NAV_ITEMS: MainNavItem[] = [
  { key: "home", label: "Início", href: "/", icon: "home", isExternal: false, opensInNewTab: false },
  { key: "login", label: "Entrar", href: "/login", icon: "user", isExternal: false, opensInNewTab: false },
];

export const FALLBACK_SITEMAP_ITEMS: SitemapItem[] = [
  {
    key: "nav",
    label: "Navegação",
    href: null,
    isExternal: false,
    opensInNewTab: false,
    children: [
      { key: "home", label: "Início", href: "/", isExternal: false, opensInNewTab: false, children: [] },
      { key: "login", label: "Entrar", href: "/login", isExternal: false, opensInNewTab: false, children: [] },
    ],
  },
];
