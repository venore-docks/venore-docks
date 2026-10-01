// Peças client do kit (W3): hooks, stores, camadas de navegação mobile e botões do header.
// Reexportado por "@venore/theme-sdk/kit-client".
export * from "../hooks";
export { useSidebarCollapsed, setSidebarCollapsed } from "../stores/sidebar-collapse-store";
export { SidebarCollapseButton } from "../regions/site-header/sidebar-collapse-button";
export { HeaderScrollSentinel } from "../regions/site-header/header-scroll-sentinel";
export { MobileNavOverlay, KIT_MOBILE_NAV_PANEL_ID } from "../regions/mobile-nav/mobile-nav-overlay";
export { MobileBottomBar, KIT_MOBILE_MORE_PANEL_ID, MOBILE_BOTTOM_BAR_MAX_ITEMS } from "../regions/mobile-nav/mobile-bottom-bar";
export { MobileNavList } from "../regions/mobile-nav/mobile-nav-list";
export { MobileNavDrawer } from "../regions/mobile-nav/mobile-nav-drawer";
