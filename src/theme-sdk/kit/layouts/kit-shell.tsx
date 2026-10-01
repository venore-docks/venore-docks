import type { ThemeShellProps } from "@/contexts/themes/contracts/types";
import { HeaderSlot } from "./HeaderSlot";
import { FooterSlot } from "./FooterSlot";
import { ContentSlot } from "./ContentSlot";
import { SidebarLeftSlot } from "./SidebarLeftSlot";

// Único export que o contrato de tema exige (docs/themes/shell-contract.md — Abordagem A): dono
// da árvore/arranjo entre as regiões estruturais. Header em cima; abaixo, SidebarLeft e uma
// coluna de conteúdo lado a lado dentro de um `flex` — essa árvore morava em
// `(platform)/layout.tsx` antes desta sessão; migrou pra cá porque quem decide arranjo agora é
// sempre o tema, nunca `platform/` (docs/venore-docks.md — "Contrato de slot"). Header/Footer/
// Content/SidebarLeft continuam existindo como componentes internos próprios do Venore Slime —
// outro tema não precisa nomear as próprias peças internas assim, só precisa exportar um `Shell`
// que aceite `ThemeShellProps`.
//
// Footer mora DENTRO da coluna de conteúdo (abaixo de ContentSlot), não como irmão do `flex`
// externo (correção desta sessão — paridade com o protótipo venore-docks,
// platform-frame.tsx:281-297, onde PlatformFooter é filho da mesma coluna que `<main>`, nunca
// solto na `<div className="grid...">` ao lado da sidebar). Colocar Footer fora da coluna fazia
// ele esticar de ponta a ponta por baixo da sidebar; com Footer dentro da coluna, o `flex` externo
// (align-items: stretch, default) estica SidebarLeftSlot pra acompanhar a altura de
// Content+Footer somados — a sidebar termina exatamente onde o footer termina, nunca por cima ou
// por baixo dele.
export function Shell({
  header,
  footer,
  sidebarLeft,
  children,
  sidebarContextualEnabled,
  sidebarContextual,
  breadcrumbs,
  breadcrumbsJsonLd,
}: ThemeShellProps) {
  return (
    <>
      <HeaderSlot {...header} />
      <div className="flex flex-1">
        <SidebarLeftSlot {...sidebarLeft} />
        <div className="flex min-w-0 flex-1 flex-col">
          <ContentSlot
            sidebarContextualEnabled={sidebarContextualEnabled}
            sidebarContextual={sidebarContextual}
            breadcrumbs={breadcrumbs}
            breadcrumbsJsonLd={breadcrumbsJsonLd}
          >
            {children}
          </ContentSlot>
          <FooterSlot {...footer} />
        </div>
      </div>
    </>
  );
}
