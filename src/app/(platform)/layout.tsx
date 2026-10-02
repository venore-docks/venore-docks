import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUserRegistrationStatus } from "@/contexts/auth";
import { RouteChangeRefresher } from "@/platform/breadcrumbs/route-change-refresher";
import { HeaderOffsetSync } from "@/platform/header-behavior/header-offset-sync";
import { resolveThemeRenderModel } from "@/platform/theme-rendering/render-model";
import { LegacyShellAdapter } from "@/platform/theme-rendering/legacy-shell-adapter";
import { ThemeRenderer } from "@/platform/theme-rendering/theme-renderer";
import { toKitAdminDefinition } from "@/platform/theme-rendering/resolve-theme-definition";
import { renderState } from "@/platform/theme-rendering/render-state";
import { templateText } from "@/theme-sdk/kit/templates/template-strings";
import { PreviewBanner } from "@/platform/theme-rendering/preview-banner";
import { signOutAction } from "@/app/(auth)/actions";

// Shell única (docs/venore-docks.md — "Shell única — sem área admin separada"), montada uma vez
// aqui pra toda página pública e admin. Congelado depois da Fase F da v8 (spec §6): o dado vem de
// resolveThemeRenderModel() e o desenho é decidido pela forma do tema —
//   manutenção (W4)      ⇒ estado "maintenance" do kit no lugar do conteúdo;
//   tema 7.x             ⇒ LegacyShellAdapter (o Shell do pacote, público e admin, como antes);
//   v8 em /admin/**      ⇒ kit topbar só com cores/marca do tema (invariante §0.5);
//   v8 no site           ⇒ ThemeRenderer (layout/regiões do tema sobre o kit).
export const dynamic = "force-dynamic";

export default async function PlatformLayout({
  children,
  sidebarContextual,
}: {
  children: React.ReactNode;
  // Slot paralelo @sidebarContextual (Next.js parallel routes) — preenchido pelo dispatcher
  // @sidebarContextual/[...slug]; o default devolve null. Nunca é usado pra decidir se HÁ conteúdo
  // (resolve-contextual-bar.ts decide pela rota), só renderizado quando a decisão é "plugin".
  sidebarContextual: React.ReactNode;
}) {
  const registrationStatus = await getCurrentUserRegistrationStatus();
  if (registrationStatus.success && registrationStatus.data === "pending") {
    redirect("/pending-approval");
  }

  const model = await resolveThemeRenderModel({ contextualSlot: sidebarContextual, onSignOut: signOutAction });
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  const content = model.maintenance
    ? renderState(model.theme, "maintenance", {
        title: templateText(model.strings, "maintenance.title"),
        // null de propósito: renderState lê a mensagem configurada em /admin/settings (ou o texto
        // padrão do kit) num componente async, sem atrasar o resto do layout.
        message: null,
        action: null,
        strings: model.strings,
        locale: model.locale,
        dir: model.dir,
        options: model.options.values,
        area: model.area,
      })
    : children;

  return (
    <>
      <RouteChangeRefresher />
      <HeaderOffsetSync />
      <PreviewBanner override={model.override} />
      {model.theme.legacyShell ? (
        <LegacyShellAdapter model={model} nonce={nonce}>
          {content}
        </LegacyShellAdapter>
      ) : model.area === "admin" ? (
        <ThemeRenderer model={{ ...model, theme: toKitAdminDefinition(model.theme) }} nonce={nonce}>
          {content}
        </ThemeRenderer>
      ) : (
        <ThemeRenderer model={model} nonce={nonce}>
          {content}
        </ThemeRenderer>
      )}
    </>
  );
}
