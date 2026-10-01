import type { ThemeLayoutProps } from "@/contexts/themes/contracts/v8";
import { ContentFrame } from "./content-frame";

// Layout "topbar" do kit = o arranjo do Shell do venore-slime (header em cima; rail e coluna de
// conteúdo lado a lado; footer DENTRO da coluna de conteúdo, pra a rail terminar junto com ele —
// ver o histórico em kit-shell.tsx). Recebe as regiões já renderizadas pelo ThemeRenderer.
// Dono a partir da Fase F: W3.
export function TopbarLayout({ regions, children }: ThemeLayoutProps) {
  return (
    <>
      {regions.skipLink}
      {regions.header}
      <div className="flex flex-1">
        {regions.rail}
        <div className="flex min-w-0 flex-1 flex-col">
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
