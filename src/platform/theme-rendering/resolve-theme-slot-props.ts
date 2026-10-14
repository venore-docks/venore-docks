import { getCurrentUser } from "@/contexts/auth";
import { getMenuByLocation } from "@/contexts/cms";
import type { ResolvedMenuItem } from "@/contexts/cms";
import { getMediaAsset } from "@/contexts/media";
import { getBrandConfig } from "@/platform/brand/get-brand-config";
import { getHeaderBehavior } from "@/platform/header-behavior/get-header-behavior";
import { getNavVisibility } from "@/platform/nav-visibility/get-nav-visibility";
import { collectNotificationAlert } from "@/platform/notifications/notification-registry";
import { collectUserNavItems } from "@/platform/user-nav/registry";
import { resolveBrandAesthetics } from "./resolve-brand-aesthetics";
import { toSitemapItems } from "./to-sitemap-items";
import { FALLBACK_MAIN_NAV_ITEMS, FALLBACK_SITEMAP_ITEMS, THEME_SLOT_DEFAULTS } from "./slot-defaults";
import type { HeaderSlotProps, HeaderUserInfo, FooterSlotProps, SidebarLeftSlotProps, NavMode, MainNavItem, NavGroup, NavItem } from "@/contexts/themes";

// item "label" (href null, contexts/cms/contracts/types.ts — MenuItemTarget) é o agregador: só
// vira MainNavItem (e some da árvore) se sobrar ao menos um filho depois da permissão/visibilidade
// já filtradas em contexts/cms (menu-resolution.ts) — grupo vazio não vai pro payload (mesmo
// invariante de "ator não vê o que não pode ver", só que aplicado à ausência do agrupador em si,
// não só dos itens dentro dele). Item com href sempre sobrevive, mesmo sem children — vira folha.
function toMainNavItems(items: ResolvedMenuItem[]): MainNavItem[] {
  return items.flatMap((item): MainNavItem[] => {
    const children = toMainNavItems(item.children);
    const icon = item.icon ?? undefined;
    if (item.href === null) {
      return children.length > 0 ? [{ key: item.id, label: item.label, href: null, icon, children }] : [];
    }
    return [{ key: item.id, label: item.label, href: item.href, icon, isExternal: item.isExternal, opensInNewTab: item.opensInNewTab }];
  });
}

// header-nav própria do Header: menu de location "header" do CMS (mesmo modelo de "main" e
// "sitemap"). NavItem é plano (sem aninhamento): item com link entra direto; item-rótulo (href
// null) é agregador, então os filhos com link sobem um nível no lugar dele.
function toHeaderNavItems(items: ResolvedMenuItem[]): NavItem[] {
  return items.flatMap((item): NavItem[] => {
    if (item.href === null) {
      return item.children.flatMap((child) =>
        child.href === null ? [] : [{ key: child.id, label: child.label, href: child.href, icon: child.icon ?? undefined }],
      );
    }
    return [{ key: item.id, label: item.label, href: item.href, icon: item.icon ?? undefined }];
  });
}

// Remove o link "Entrar" dos menus de EXEMPLO (FALLBACK_*, instalação sem menu no CMS) quando o
// admin escondeu o login da navegação (nav.hideLoginLink) — senão ele seguia aparecendo na
// sidebar e no rodapé. Menu configurado no CMS é decisão do admin e não é filtrado.
function withoutFallbackLogin<T extends { key: string; children?: T[] }>(items: T[]): T[] {
  return items
    .filter((item) => item.key !== "login")
    .map((item) => (item.children ? { ...item, children: withoutFallbackLogin(item.children) } : item));
}

// Usuário do header (nome, email, avatar). avatarMediaId (escolhido via seletor de mídia) tem
// prioridade sobre `image` (populado pelo provider OAuth) — mesmo princípio de "tema nunca busca
// dado sozinho": a resolução mediaId→url acontece aqui, na composição, não dentro do tema.
async function resolveHeaderUser(): Promise<HeaderUserInfo | null> {
  const currentUser = await getCurrentUser();
  if (!currentUser.success || !currentUser.data) return null;
  const avatarMedia = currentUser.data.avatarMediaId ? await getMediaAsset({ id: currentUser.data.avatarMediaId }) : null;
  const imageUrl = avatarMedia?.success ? (avatarMedia.data?.url ?? currentUser.data.image) : currentUser.data.image;
  return { displayName: currentUser.data.name ?? currentUser.data.email ?? "Usuário", email: currentUser.data.email, imageUrl };
}

// Este é o ÚNICO lugar do sistema onde valor de plataforma vira prop de slot — nunca dentro do
// próprio tema. navMode/navItems/canToggleAdminNav já são resolvidos de verdade (platform/nav-mode
// + platform/admin-shell), passados pelo layout e mesclados no SidebarLeft (main-nav/admin-nav não
// vivem no Header). O dado de usuário do Header (user/canAccessAdmin/onSignOut) segue o mesmo
// princípio: resolvido aqui a partir de @/contexts/auth, nunca dentro do próprio tema. main-nav
// agora vem de contexts/cms (menu "main"); se a leitura falhar, cai em FALLBACK_MAIN_NAV_ITEMS
// (slot-defaults.ts) pra nunca deixar a sidebar vazia. Os valores de slot sem fonte real
// (userbarEnabled, headerNavItems, footer.creditsEnabled, sidebarLeft.enabled) vêm de
// THEME_SLOT_DEFAULTS — constantes de plataforma, não mais o mock do tema Slime espalhado.
// header.brand e footer.brand: conteúdo (nome/logos) vem de contexts/settings (getBrandConfig,
// sobrevive a troca de tema); estética (mode/size/scrolledSize/position/color) vem do tema ativo
// (resolveBrandAesthetics — T2, docs/implementation-roadmap.md Fase 5), não é mais mock nem
// settings. header.stickyEnabled/scrollShrinkEnabled vêm de contexts/settings via
// getHeaderBehavior (T4, mesma fase). footer.sitemapItems vem de contexts/cms (menu de location
// "sitemap", via to-sitemap-items.ts) — sem menu configurado, fica [] (nunca cai pra mock nem
// deriva de conteúdo publicado).
export async function resolveThemeSlotProps(sidebarNav: {
  navMode: NavMode;
  adminNavGroups: NavGroup[];
  canToggleAdminNav: boolean;
  onToggleNavMode: () => Promise<void>;
  canAccessAdmin: boolean;
  onSignOut: () => Promise<void>;
  collapsed: boolean;
  onToggleCollapsed: () => Promise<void>;
}): Promise<{
  header: HeaderSlotProps;
  footer: FooterSlotProps;
  sidebarLeft: SidebarLeftSlotProps;
}> {
  // location "main" (não "main-nav") desde a reescrita do subsistema de navegação — modelo de
  // menu/localização documentado em contexts/cms/contracts/types.ts. Árvore inteira é usada agora
  // (MainNavItem suporta aninhamento — toMainNavItems acima): item "label" (href null) vira
  // agregador/accordion na sidebar em vez de ser descartado. header-nav vem do menu "header"
  // (toHeaderNavItems acima) — o Menu Contextual (location "contextual") foi ligado nesta sessão,
  // mas fora deste função: app/(platform)/layout.tsx é quem chama getContextualMenu e monta
  // ContentSlotProps.sidebarContextual, não resolveThemeSlotProps (essa função só resolve
  // header/footer/sidebarLeft).
  // location "sitemap": menu dedicado (contexts/cms/contracts/types.ts — MenuLocation), distinto
  // do "main" acima. Sem menu configurado (instalação nova) ou com leitura falhando, cai num
  // exemplo mínimo (FALLBACK_SITEMAP_ITEMS) — não é derivação de "todo conteúdo publicado" (isso
  // violaria o invariante de contexts/cms de que o sitemap é o que o menu escolheu mostrar), é só
  // um esqueleto estático pra o rodapé não ficar quebrado antes de o admin configurar o menu.
  // notificationAlert só é consultado pra quem está logado — visitante anônimo nunca tem thread
  // nenhuma (collectNotificationAlert já devolveria null de qualquer forma, mas evita a query à
  // toa).
  // Tudo que não depende do usuário começa junto com a resolução dele (antes: usuário → avatar →
  // estética da marca → Promise.all, quatro idas ao banco em série).
  const userPromise = resolveHeaderUser();
  const aestheticsPromise = resolveBrandAesthetics();
  const [user, aesthetics, mainMenu, sitemapMenu, headerMenu, brandConfig, headerBehavior, navVisibility, notificationAlert, userNavItems] = await Promise.all([
    userPromise,
    aestheticsPromise,
    getMenuByLocation({ location: "main" }),
    getMenuByLocation({ location: "sitemap" }),
    getMenuByLocation({ location: "header" }),
    aestheticsPromise.then((resolved) => getBrandConfig(resolved.mode)),
    getHeaderBehavior(),
    getNavVisibility(),
    userPromise.then((resolved) => (resolved ? collectNotificationAlert() : null)),
    userPromise.then((resolved) => (resolved ? collectUserNavItems() : [])),
  ]);
  // Fallback quando o menu está VAZIO (instalação nova, sem menu no CMS) — não só quando a
  // leitura falha. Sem isso a sidebar renderiza "—" e o rodapé fica sem navegação nenhuma.
  const resolvedMainNav = mainMenu.success ? toMainNavItems(mainMenu.data) : [];
  const fallbackMainNav = navVisibility.hideLoginLink ? withoutFallbackLogin(FALLBACK_MAIN_NAV_ITEMS) : FALLBACK_MAIN_NAV_ITEMS;
  const mainNavItems: MainNavItem[] = resolvedMainNav.length > 0 ? resolvedMainNav : fallbackMainNav;

  const resolvedSitemap = sitemapMenu.success ? toSitemapItems(sitemapMenu.data) : [];
  const fallbackSitemap = navVisibility.hideLoginLink ? withoutFallbackLogin(FALLBACK_SITEMAP_ITEMS) : FALLBACK_SITEMAP_ITEMS;
  const sitemapItems = resolvedSitemap.length > 0 ? resolvedSitemap : fallbackSitemap;

  // Sem menu "header" no CMS (ou leitura falhando): nenhum link — header-nav não tem exemplo.
  const headerNavItems = headerMenu.success ? toHeaderNavItems(headerMenu.data) : [];

  return {
    header: {
      brand: {
        name: brandConfig.siteName,
        mode: aesthetics.mode,
        size: aesthetics.size,
        scrolledSize: aesthetics.scrolledSize,
        position: aesthetics.position,
        logoUrl: brandConfig.logoUrl,
        scrolledLogoUrl: brandConfig.scrolledLogoUrl,
      },
      // nav.hideLoginLink também desliga a userbar pro visitante deslogado: `showLoginLink` é
      // extensão aditiva do contrato que só o venore-slime lê — os temas @venore/theme-* ignoram e
      // seguiam mostrando "Entrar". Sem usuário, a userbar de todo tema só tem esse link, então
      // `userbarEnabled=false` esconde exatamente ele; logado, a userbar (UserMenu) fica intacta.
      userbarEnabled: THEME_SLOT_DEFAULTS.userbarEnabled && !(navVisibility.hideLoginLink && !user),
      stickyEnabled: headerBehavior.sticky,
      scrollShrinkEnabled: headerBehavior.scrollShrink,
      headerNavItems,
      user,
      canAccessAdmin: sidebarNav.canAccessAdmin,
      onSignOut: sidebarNav.onSignOut,
      notificationAlert,
      userNavItems,
      showLoginLink: !navVisibility.hideLoginLink,
    },
    footer: {
      brand: {
        name: brandConfig.siteName,
        mode: aesthetics.mode,
        size: aesthetics.size,
        scrolledSize: aesthetics.scrolledSize,
        position: aesthetics.position,
        logoUrl: brandConfig.logoUrl,
        scrolledLogoUrl: brandConfig.scrolledLogoUrl,
        color: aesthetics.color,
        description: brandConfig.footerDescription,
      },
      sitemapItems,
      creditsEnabled: THEME_SLOT_DEFAULTS.footerCreditsEnabled,
      loginLinkHref: navVisibility.hideLoginLink && navVisibility.showLoginInFooter && !user ? "/login" : null,
    },
    sidebarLeft: {
      enabled: THEME_SLOT_DEFAULTS.sidebarLeftEnabled,
      navMode: sidebarNav.navMode,
      navItems: sidebarNav.navMode === "admin" ? [] : mainNavItems,
      navGroups: sidebarNav.navMode === "admin" ? sidebarNav.adminNavGroups : [],
      canToggleAdminNav: sidebarNav.canToggleAdminNav,
      onToggleNavMode: sidebarNav.onToggleNavMode,
      collapsed: sidebarNav.collapsed,
      onToggleCollapsed: sidebarNav.onToggleCollapsed,
    },
  };
}
