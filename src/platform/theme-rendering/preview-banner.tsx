import type { RenderOverride } from "@/contexts/themes/contracts/v8";
import { PreviewBannerBar } from "@/platform/theme-preview/preview-banner-bar";
import { PreviewBridge } from "@/theme-sdk/kit/preview-bridge";

// Faixa "você está vendo um rascunho/galeria/modo seguro" com publicar/descartar/sair (spec §7.2),
// mais o PreviewBridge do kit quando o override é de rascunho (edições instantâneas vindas do
// /admin/themes/customize). Sem override (o caso de todo visitante) não renderiza nada. O override
// já chega validado (HMAC, dono da sessão, settings.manage) por read-theme-override.ts.
export function PreviewBanner({ override }: { override: RenderOverride | null }) {
  if (!override) return null;
  return (
    <>
      {override.kind === "draft" && <PreviewBridge />}
      <PreviewBannerBar kind={override.kind} />
    </>
  );
}
