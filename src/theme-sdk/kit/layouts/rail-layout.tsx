import { ContentFrame } from "./content-frame";
import type { KitLayoutProps } from "./kit-layout-props";

// Layout "rail" do kit = o arranjo do Aurora 0.1.13 (developer tool: Linear/Vercel/Supabase): a
// rail ocupa a altura INTEIRA da viewport, de ponta a ponta, sticky a partir de lg (o menu rola
// dentro dela) — o header NÃO corre por cima dela, só sobre a coluna de conteúdo à direita.
// Header/conteúdo/footer empilhados nessa coluna; o `flex` externo (align-items: stretch) estica a
// rail pra acompanhar a coluna inteira. O ThemeRenderer complementa o arranjo: botão de colapso no
// header (`collapseControl` padrão "header") e menu do header escondido abaixo de lg e mostrado no
// drawer (`headerNavVisibleFrom` padrão "lg").
export function RailLayout({ regions, page, children, strings, contextualMobile }: KitLayoutProps) {
  return (
    <>
      {regions.skipLink}
      <div data-layout="rail" className="flex min-h-dvh flex-1">
        {regions.rail}
        <div className="flex min-w-0 flex-1 flex-col">
          {regions.header}
          <ContentFrame
            breadcrumbs={regions.breadcrumbs}
            contextualBar={regions.contextualBar}
            contextualPlacement={page.contextualPlacement}
            contextualMobile={contextualMobile}
            strings={strings}
          >
            {children}
          </ContentFrame>
          {regions.footer}
        </div>
      </div>
      {regions.mobileNav}
    </>
  );
}
