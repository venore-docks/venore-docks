"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ThemePaletteChoice } from "@/contexts/themes/contracts/v8";
import type { PaletteContrastView } from "@/platform/theme-engine/palette/palette-admin";
import { buildPalettePanelData } from "@/platform/theme-engine/palette/palette-panel-data";
import { checkPaletteContrastAction, generateSeedPaletteAction } from "../../actions";
import {
  currentPaletteChoice,
  PALETTE_PANEL_TOKENS,
  setCustomToken,
  toPickerHex,
  withPaletteChoice,
  type PaletteMode,
} from "../../_components/palette-draft";
import type { DraftPanelProps } from "./types";

// Painel "Paleta" de /admin/themes/customize (spec v8 §9/§7.14). Dono: W1. Edita
// `byTheme[tema].palette` do rascunho: padrão do tema, preset do catálogo, cor de marca (semente
// gerada no servidor com as regras do tema — tons por região inclusos) ou personalizada. Só
// devolve patch (onChange); salvar e recarregar o preview é da página (W6).

const MODE_LABELS: Record<PaletteMode, string> = {
  default: "Padrão do tema",
  preset: "Preset do catálogo",
  seed: "Cor de marca",
  custom: "Personalizada",
};
const TONE_LABELS = { light: "claro", dark: "escuro", brand: "cor de marca", inherit: "herdado" } as const;
const REGION_LABELS = { header: "Header", rail: "Rail", contextual: "Barra contextual", content: "Conteúdo", footer: "Rodapé" } as const;
const DEFAULT_SEED = "#3366cc";

export function PalettePanel({ draft, theme, onChange }: DraftPanelProps) {
  // Presets, sementes e tons por região vêm da view do tema (colorPalettes/palette): sem ida ao
  // servidor. Só gerar a paleta da semente e checar contraste usam actions (gerador + tokens).
  const data = useMemo(() => buildPalettePanelData(theme), [theme]);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<PaletteContrastView[] | null>(null);
  const [pending, startTransition] = useTransition();
  const choice = currentPaletteChoice(draft, theme.key);
  const [seed, setSeed] = useState(choice.mode === "seed" ? (toPickerHex(choice.seed) ?? DEFAULT_SEED) : DEFAULT_SEED);

  const apply = (next: ThemePaletteChoice) => {
    setProblems(null);
    onChange(withPaletteChoice(draft, theme.key, next));
  };

  const generate = (value: string) =>
    startTransition(async () => {
      const result = await generateSeedPaletteAction(theme.key, value);
      setError(result.error);
      if (!result.data) return;
      onChange(withPaletteChoice(draft, theme.key, result.data.choice));
      setProblems(result.data.problems);
    });

  const verify = () =>
    startTransition(async () => {
      const result = await checkPaletteContrastAction(theme.key, choice);
      setError(result.error);
      setProblems(result.data);
    });

  const modes: PaletteMode[] = ["default", "preset", "seed", ...(data.allowCustom === false ? [] : (["custom"] as const))];

  return (
    <section aria-labelledby="palette-panel-title" className="space-y-4 rounded-panel border border-border bg-card ui-panel-padding-roomy">
      <div>
        <h2 id="palette-panel-title" className="text-sm font-semibold text-foreground">
          Paleta
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          A paleta vale só para este tema no rascunho. Cores da marca são geradas respeitando as regras do tema.
        </p>
      </div>

      <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <legend className="sr-only">Origem da paleta</legend>
        {modes.map((mode) => (
          <label key={mode} className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="radio"
              name="palette-mode"
              value={mode}
              checked={choice.mode === mode}
              disabled={mode === "preset" && data.presets.length === 0}
              onChange={() => {
                if (mode === "default") apply({ mode: "default" });
                else if (mode === "preset" && data.presets[0]) apply({ mode: "preset", presetId: data.presets[0].id });
                else if (mode === "seed") generate(seed);
                else if (mode === "custom") apply(setCustomToken(choice, "light", "primary", toPickerHex(seed)));
              }}
            />
            {MODE_LABELS[mode]}
          </label>
        ))}
      </fieldset>

      {choice.mode === "preset" && (
        <ul className="space-y-2">
          {data.presets.map((preset) => (
            <li key={preset.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-foreground">
                <span aria-hidden className="flex overflow-hidden rounded-md border border-border">
                  {preset.swatches.map((color, index) => (
                    <span key={index} className="size-4" style={{ background: color }} />
                  ))}
                </span>
                {preset.name}
              </span>
              {choice.presetId === preset.id ? (
                <Badge variant="secondary">Escolhido</Badge>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => apply({ mode: "preset", presetId: preset.id })}>
                  Usar
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {choice.mode === "seed" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-foreground">
              Cor de marca
              <input
                type="color"
                value={seed}
                onChange={(event) => setSeed(event.target.value)}
                className="h-9 w-14 cursor-pointer rounded-md border border-border bg-transparent outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => generate(seed)}>
              Gerar paleta
            </Button>
          </div>
          {data.seedPresets.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.seedPresets.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    setSeed(toPickerHex(preset.seed) ?? DEFAULT_SEED);
                    generate(preset.seed);
                  }}
                >
                  {preset.name}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {choice.mode === "custom" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(["light", "dark"] as const).map((mode) => (
            <fieldset key={mode} className="space-y-2">
              <legend className="text-xs font-medium text-muted-foreground">{mode === "light" ? "Modo claro" : "Modo escuro"}</legend>
              {PALETTE_PANEL_TOKENS.map(({ token, label }) => {
                const value = toPickerHex(choice[mode][token]);
                const locked = data.lockedTokens.some((name) => name.replace(/^--/, "") === token);
                return (
                  <div key={token} className="flex items-center justify-between gap-2 text-sm text-foreground">
                    <label htmlFor={`palette-${mode}-${token}`}>{label}</label>
                    <span className="flex items-center gap-2">
                      <input
                        id={`palette-${mode}-${token}`}
                        type="color"
                        value={value ?? "#000000"}
                        disabled={locked}
                        onChange={(event) => apply(setCustomToken(choice, mode, token, event.target.value))}
                        className="h-8 w-12 cursor-pointer rounded-md border border-border bg-transparent outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      {value && !locked ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => apply(setCustomToken(choice, mode, token, null))}>
                          Tema
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">{locked ? "travado" : "do tema"}</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </fieldset>
          ))}
        </div>
      )}

      {data.regionTones.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Tons por região definidos pelo tema:{" "}
          {data.regionTones.map((tone) => `${REGION_LABELS[tone.region]} ${TONE_LABELS[tone.tone]}`).join(", ")}.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" disabled={pending || choice.mode === "default"} onClick={verify}>
          Verificar contraste
        </Button>
        {problems && problems.length === 0 && <Badge variant="secondary">Contraste ok em todas as regiões</Badge>}
      </div>

      {problems && problems.length > 0 && (
        <ul role="status" className="space-y-1 text-xs text-warning">
          {problems.map((problem, index) => (
            <li key={index}>{problem.message}</li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
