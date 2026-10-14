import type { ReactNode } from "react";
import type { ThemeRenderModel } from "@/contexts/themes/contracts/v8";
import { CoreJsonLd } from "@/theme-sdk/kit/json-ld";
import { KitContextualMenuNav } from "@/theme-sdk/kit/regions/contextual-bar/contextual-bar";

// Adapter dos temas 7.x (spec §8): o Shell do pacote recebe as mesmas props de hoje, com duas
// diferenças deliberadas — a barra contextual vem do dado (`model.contextual`) e o JSON-LD da trilha
// é renderizado pelo CORE (breadcrumbsJsonLd=null pro Shell), fechando o XSS de JSON.stringify cru
// dos pacotes. Outlets: só content.before/after. Dono: Fase F.
export function LegacyShellAdapter({ model, nonce, children }: { model: ThemeRenderModel; nonce?: string; children: ReactNode }) {
  const Shell = model.theme.legacyShell;
  if (!Shell) return null;
  const { contextual } = model;

  return (
    <>
      <Shell
        header={model.slotProps.header}
        footer={model.slotProps.footer}
        sidebarLeft={model.slotProps.sidebarLeft}
        sidebarContextualEnabled={contextual.source !== "none"}
        sidebarContextual={
          contextual.source === "none" ? null : contextual.source === "menu" ? (
            <KitContextualMenuNav items={contextual.items} strings={model.strings} />
          ) : (
            contextual.node
          )
        }
        breadcrumbs={model.breadcrumbs}
        breadcrumbsJsonLd={null}
      >
        {model.outlets["content.before"]}
        {children}
        {model.outlets["content.after"]}
      </Shell>
      {model.breadcrumbs.length > 0 && <CoreJsonLd data={model.breadcrumbsJsonLd} nonce={nonce} />}
    </>
  );
}
