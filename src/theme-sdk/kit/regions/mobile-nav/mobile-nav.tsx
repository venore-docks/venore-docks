import type { MobileNavRegionProps } from "@/contexts/themes/contracts/v8";

// Região mobileNav do kit. No modo "drawer" (o padrão, e o único na Fase F) a navegação mobile É a
// rail em off-canvas (MobileNavDrawer dentro de SidebarLeftSlot), então esta região não acrescenta
// markup. Dono: W3 (modos bottom-bar e fullscreen).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function MobileNav(_props: MobileNavRegionProps): null {
  return null;
}
