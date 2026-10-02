import { resolveDocumentModel } from "@/platform/theme-rendering/document-model";
import { pageLayoutMarkerAttributes, resolvePageLayout } from "./page-layout";

// Marcador do layout da página ATUAL (spec §3 / §7.15). O (platform)/layout não re-renderiza em
// navegação soft, então o `page` do render-model fica com o valor da primeira página carregada; a
// página emite este marcador (vazio, oculto) e page-layout.css aplica largura/rail/barra contextual
// por `:has([data-page-…])`. Mesmo cálculo do layout (resolveDocumentModel e resolvePageLayout são
// cache() por request): na carga inicial marcador e estrutura sempre concordam.
export async function PageLayoutMarker() {
  const document = await resolveDocumentModel();
  if (document.area === "admin") return null;
  const layout = await resolvePageLayout(document.pathname, document.theme, document.section);
  return <span hidden {...pageLayoutMarkerAttributes(layout)} />;
}
