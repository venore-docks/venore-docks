import { getCurrentUser } from "@/contexts/auth";
import { getMenuByLocation } from "@/contexts/cms";
import type { ResolvedMenuItem } from "@/contexts/cms";
import { getMediaAsset } from "@/contexts/media";
import { getBrandConfig } from "@/platform/brand/get-brand-config";
import { getHeaderBehavior } from "@/platform/header-behavior/get-header-behavior";
import { collectNotificationAlert } from "@/platform/notifications/notification-registry";
import { collectUserNavItems } from "@/platform/user-nav/registry";
import { resolveBrandAesthetics } from "./resolve-brand-aesthetics";
import { toSitemapItems } from "./to-sitemap-items";
import { FALLBACK_MAIN_NAV_ITEMS, FALLBACK_SITEMAP_ITEMS, THEME_SLOT_DEFAULTS } from "./slot-defaults";
import type { HeaderSlotProps, HeaderUserInfo, FooterSlotProps, SidebarLeftSlotProps, NavMode, MainNavItem, NavGroup } from "@/contexts/themes";

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
    return [{ key: item.id, label: item.label, href: item.href, icon }];
  });
}

// TODO: substituir header-nav por composição real de contexts/rbac quando esse escopo existir.
// Até lá, este é o ÚNICO lugar do sistema onde dado mockado vira prop de slot — nunca dentro do
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
  const currentUser = await getCurrentUser();
  let avatarUrl: string | null = null;
  if (currentUser.success && currentUser.data) {
    // avatarMediaId (escolhido via seletor de mídia) tem prioridade sobre `image` (populado pelo
    // provider OAuth) — mesmo princípio de "tema nunca busca dado sozinho": a resolução mediaId→url
    // acontece aqui, na composição, não dentro do tema.
    const avatarMedia = currentUser.data.avatarMediaId ? await getMediaAsset({ id: currentUser.data.avatarMediaId }) : null;
    avatarUrl = avatarMedia?.success ? (avatarMedia.data?.url ?? currentUser.data.image) : currentUser.data.image;
  }
  const user: HeaderUserInfo | null =
    currentUser.success && currentUser.data
      ? {
          displayName: currentUser.data.name ?? currentUser.data.email ?? "Usuário",
          email: currentUser.data.email,
          imageUrl: avatarUrl,
        }
      : null;

  // location "main" (não "main-nav") desde a reescrita do subsistema de navegação — modelo de
  // menu/localização documentado em contexts/cms/contracts/types.ts. Árvore inteira é usada agora
  // (MainNavItem suporta aninhamento — toMainNavItems acima): item "label" (href null) vira
  // agregador/accordion na sidebar em vez de ser descartado. header-nav e contextual continuam
  // fora desta sessão (Known Gap, AGENTS.md §7).
  // location "sitemap": menu dedicado (contexts/cms/contracts/types.ts — MenuLocation), distinto
  // do "main" acima. Sem menu configurado (instalação nova) ou com leitura falhando, cai num
  // exemplo mínimo (FALLBACK_SITEMAP_ITEMS) — não é derivação de "todo conteúdo publicado" (isso
  // violaria o invariante de contexts/cms de que o sitemap é o que o menu escolheu mostrar), é só
  // um esqueleto estático pra o rodapé não ficar quebrado antes de o admin configurar o menu.
  const aesthetics = await resolveBrandAesthetics();
  // messageAlert só é consultado pra quem está logado — visitante anônimo nunca tem thread nenhuma
  // (getMessageAlert já devolveria null de qualquer forma, mas evita a query à toa).
  const [mainMenu, sitemapMenu, brandConfig, headerBehavior, messageAlert, userNavItems] = await Promise.all([
    getMenuByLocation({ location: "main" }),
    getMenuByLocation({ location: "sitemap" }),
    getBrandConfig(aesthetics.mode),
    getHeaderBehavior(),
    user ? collectNotificationAlert() : Promise.resolve(null),
    user ? collectUserNavItems() : Promise.resolve([]),
  ]);
  // Fallback quando o menu está VAZIO (instalação nova, sem menu no CMS) — não só quando a
  // leitura falha. Sem isso a sidebar renderiza "—" e o rodapé fica sem navegação nenhuma.
  const resolvedMainNav = mainMenu.success ? toMainNavItems(mainMenu.data) : [];
  const mainNavItems: MainNavItem[] = resolvedMainNav.length > 0 ? resolvedMainNav : FALLBACK_MAIN_NAV_ITEMS;

  const resolvedSitemap = sitemapMenu.success ? toSitemapItems(sitemapMenu.data) : [];
  const sitemapItems = resolvedSitemap.length > 0 ? resolvedSitemap : FALLBACK_SITEMAP_ITEMS;

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
      userbarEnabled: THEME_SLOT_DEFAULTS.userbarEnabled,
      stickyEnabled: headerBehavior.sticky,
      scrollShrinkEnabled: headerBehavior.scrollShrink,
      headerNavItems: [...THEME_SLOT_DEFAULTS.headerNavItems],
      user,
      canAccessAdmin: sidebarNav.canAccessAdmin,
      onSignOut: sidebarNav.onSignOut,
      messageAlert,
      userNavItems,
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
