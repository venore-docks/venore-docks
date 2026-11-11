import { getBrandConfig } from "@/platform/brand/get-brand-config";
import { getBrandMediaSelections } from "@/platform/brand/get-brand-media-selections";
import { resolveBrandAesthetics } from "@/platform/theme-rendering/resolve-brand-aesthetics";
import { getSettingsPageData } from "@/platform/admin-shell/get-settings-page-data";
import { BrandSettingsForm } from "./_components/brand-settings-form";

export default async function BrandSettingsPage() {
  const gate = await getSettingsPageData();

  if (!gate.granted) {
    return (
      <div className="rounded-panel border border-border bg-card ui-panel-padding-roomy text-center">
        <h1 className="text-lg font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Você não tem permissão para gerenciar a identidade do site.</p>
      </div>
    );
  }

  const aesthetics = await resolveBrandAesthetics();
  const [brand, media] = await Promise.all([getBrandConfig(aesthetics.mode), getBrandMediaSelections()]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Identidade do site</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Marca do site: nome, logos, favicon, ícone do app (PWA), imagem de compartilhamento e descrição do rodapé. Modo de exibição, tamanho, posição, cor da
          marca e comportamento do header agora são definidos pelo tema ativo (
          <span className="font-medium">/admin/themes</span>), não mais aqui.
        </p>
      </div>

      <BrandSettingsForm brand={brand} media={media} aesthetics={aesthetics} />
    </div>
  );
}
