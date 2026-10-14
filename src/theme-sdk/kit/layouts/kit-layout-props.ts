import type { ThemeLayoutProps } from "@/contexts/themes/contracts/v8";
import type { ContextualMobileMode } from "./content-frame";

// Extras que o ThemeRenderer passa aos layouts DO KIT além de ThemeLayoutProps (o contrato
// congelado). Um layout custom de tema recebe os mesmos campos e pode ignorá-los.
export type KitLayoutProps = ThemeLayoutProps & { contextualMobile?: ContextualMobileMode };
