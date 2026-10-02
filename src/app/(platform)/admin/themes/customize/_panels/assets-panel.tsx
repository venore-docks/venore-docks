"use client";

import { MediaPickerField } from "@/components/media-picker-field";
import { PANEL_CLASS } from "../_components/field-styles";
import type { DraftPanelProps } from "./types";

// Painel "Imagem de compartilhamento e ícone" (spec v8 §7.6/§9, dono W6): ids de mídia em
// `config.assets`, com precedência sobre os assets estáticos do pacote do tema (W4/W8 leem).
export function AssetsPanel({ draft, onChange }: DraftPanelProps) {
  const setAsset = (key: "ogImageMediaId" | "iconMediaId", id: string | null) => {
    const assets = { ...draft.assets };
    if (id) assets[key] = id;
    else delete assets[key];
    onChange({ assets });
  };

  return (
    <section className={PANEL_CLASS} aria-labelledby="customize-assets-title">
      <h2 id="customize-assets-title" className="text-sm font-semibold text-foreground">
        Imagem de compartilhamento e ícone
      </h2>
      <p className="text-xs text-muted-foreground">Sem escolha aqui, valem as imagens que acompanham o tema.</p>
      <div className="space-y-1">
        <MediaPickerField
          name="ogImageMediaId"
          label="Imagem de compartilhamento (Open Graph)"
          onSelect={(media) => setAsset("ogImageMediaId", media?.id ?? null)}
        />
        {draft.assets.ogImageMediaId && (
          <p className="text-xs text-muted-foreground">
            Atual: <code>{draft.assets.ogImageMediaId}</code>{" "}
            <button type="button" className="text-primary underline" onClick={() => setAsset("ogImageMediaId", null)}>
              remover
            </button>
          </p>
        )}
      </div>
      <div className="space-y-1">
        <MediaPickerField name="iconMediaId" label="Ícone do site" onSelect={(media) => setAsset("iconMediaId", media?.id ?? null)} />
        {draft.assets.iconMediaId && (
          <p className="text-xs text-muted-foreground">
            Atual: <code>{draft.assets.iconMediaId}</code>{" "}
            <button type="button" className="text-primary underline" onClick={() => setAsset("iconMediaId", null)}>
              remover
            </button>
          </p>
        )}
      </div>
    </section>
  );
}
