import type { ThemeLayoutProps } from "@/contexts/themes/contracts/v8";
import { ContentFrame } from "./content-frame";

// Esqueleto mínimo do layout "rail" (arranjo do Aurora 0.1.13: rail em altura total à esquerda,
// header e conteúdo na coluna da direita). Dono: W3, que fecha o arranjo contra o snapshot
// estrutural do Aurora.
export function RailLayout({ regions, children }: ThemeLayoutProps) {
  return (
    <>
      {regions.skipLink}
      <div className="flex flex-1">
        {regions.rail}
        <div className="flex min-w-0 flex-1 flex-col">
          {regions.header}
          <ContentFrame breadcrumbs={regions.breadcrumbs} contextualBar={regions.contextualBar}>
            {children}
          </ContentFrame>
          {regions.footer}
        </div>
      </div>
      {regions.mobileNav}
    </>
  );
}
