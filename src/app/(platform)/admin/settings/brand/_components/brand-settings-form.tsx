"use client";

import { useActionState, useState } from "react";
import { MediaPickerField } from "@/components/media-picker-field";
import { PlatformBrand } from "@/theme-sdk/kit/platform-brand";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import type { BrandAesthetics } from "@/contexts/themes";
import type { BrandConfig } from "@/platform/brand/get-brand-config";
import type { BrandMediaSelections } from "@/platform/brand/get-brand-media-selections";
import { updateBrandSettingsAction, type BrandSettingsActionState } from "../actions";

const initialState: BrandSettingsActionState = { error: null };

// T2 (docs/implementation-roadmap.md — Fase 5): mode/size/scrolledSize/position/color não são mais
// editáveis aqui — vêm do tema ativo (ThemeManifest.brandAesthetics, trocado em /admin/themes).
// `aesthetics` só alimenta o preview ao vivo (com o nome/logo que o admin está digitando/
// escolhendo agora), somente leitura.
export function BrandSettingsForm({
  brand,
  media,
  aesthetics,
}: {
  brand: BrandConfig;
  media: BrandMediaSelections;
  aesthetics: BrandAesthetics;
}) {
  const [state, formAction, pending] = useActionState(updateBrandSettingsAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Identidade do site salva." });

  // Estado local só pra alimentar o preview ao vivo — o valor de verdade que é salvo continua
  // vindo do FormData no submit (inputs não controlados, exceto pelo espelho abaixo).
  const [siteName, setSiteName] = useState(brand.siteName);
  const [logoUrl, setLogoUrl] = useState(brand.logoUrl);
  const [scrolledLogoUrl, setScrolledLogoUrl] = useState(brand.scrolledLogoUrl);

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
      <div className="space-y-4 rounded-panel border border-border bg-card ui-panel-padding-roomy">
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Nome do site</label>
          <Input
            name="siteName"
            defaultValue={brand.siteName}
            onChange={(event) => setSiteName(event.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground">Descrição no rodapé</label>
          <Textarea name="footerDescription" defaultValue={brand.footerDescription} rows={3} className="mt-1" />
        </div>

        <MediaPickerField
          name="logoMediaId"
          label="Logo"
          initialMedia={media.logo}
          onSelect={(selected) => setLogoUrl(selected?.url ?? brand.logoUrl)}
        />
        <MediaPickerField
          name="logoScrolledMediaId"
          label="Logo (quando a página está rolada)"
          initialMedia={media.logoScrolled}
          onSelect={(selected) => setScrolledLogoUrl(selected?.url ?? brand.scrolledLogoUrl)}
        />
        <MediaPickerField name="faviconMediaId" label="Favicon" initialMedia={media.favicon} />

        <Button type="submit" disabled={pending}>
          Salvar
        </Button>
      </div>

      <div className="space-y-4 rounded-panel border border-border bg-card ui-panel-padding-roomy">
        <p className="text-xs font-medium uppercase tracking-caps text-muted-foreground">Pré-visualização do cabeçalho</p>
        <p className="text-xs text-muted-foreground">
          Modo/tamanho/posição vêm do tema ativo — para alterar, use <span className="font-medium">/admin/themes</span>.
        </p>
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="mb-2 text-[11px] text-muted-foreground">Normal</p>
            <PlatformBrand
              name={siteName}
              mode={aesthetics.mode}
              size={aesthetics.size}
              scrolledSize={aesthetics.scrolledSize}
              position={aesthetics.position}
              isScrolled={false}
              logoUrl={logoUrl}
              scrolledLogoUrl={scrolledLogoUrl}
            />
          </div>
          <div className="rounded-lg border border-border bg-primary p-4 text-primary-foreground">
            <p className="mb-2 text-[11px] text-primary-foreground/80">Ao rolar a página</p>
            <PlatformBrand
              name={siteName}
              mode={aesthetics.mode}
              size={aesthetics.size}
              scrolledSize={aesthetics.scrolledSize}
              position={aesthetics.position}
              isScrolled
              logoUrl={logoUrl}
              scrolledLogoUrl={scrolledLogoUrl}
            />
          </div>
        </div>
      </div>
    </form>
  );
}
