"use client";

import { useState, useTransition } from "react";
import type { PageLayout } from "@/contexts/cms";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveEntryLayoutAction } from "../actions";

export type PageLayoutOption = { value: string; label: string };
export type PageLayoutPanelProps = {
  entryId: string;
  initialLayout: PageLayout;
  // Variantes de template "entry" declaradas pelo tema ativo (vazio = o campo não aparece).
  templateOptions: PageLayoutOption[];
  themeLabel: string;
};

const INHERIT = "auto";
const UNAVAILABLE_SUFFIX = "(indisponível neste tema)";

const WIDTH_OPTIONS: PageLayoutOption[] = [
  { value: INHERIT, label: "Automática (seção/tema)" },
  { value: "contained", label: "Contida" },
  { value: "wide", label: "Larga" },
  { value: "full", label: "Largura total" },
];
const RAIL_OPTIONS: PageLayoutOption[] = [
  { value: INHERIT, label: "Automática (seção/tema)" },
  { value: "hidden", label: "Oculta nesta página" },
];
const CONTEXTUAL_OPTIONS: PageLayoutOption[] = [
  { value: INHERIT, label: "Automática (seção/tema)" },
  { value: "side", label: "Ao lado do conteúdo" },
  { value: "top", label: "Acima do conteúdo" },
  { value: "none", label: "Oculta" },
];

function LayoutSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: PageLayoutOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="mt-1 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Painel "Layout da página" do editor visual (spec §7.15): largura, rail, barra contextual e
// variante de template desta entry. "Automática" = não sobrepõe (herda seção do tema → padrão do
// tema). Salvo à parte da composição.
export function PageLayoutPanel({ entryId, initialLayout, templateOptions, themeLabel }: PageLayoutPanelProps) {
  const [layout, setLayout] = useState<PageLayout>(initialLayout);
  const [status, setStatus] = useState<null | "saved" | "proposed" | { error: string }>(null);
  const [isPending, startTransition] = useTransition();

  function update(patch: Partial<Record<keyof PageLayout, string>>) {
    setStatus(null);
    setLayout((previous) => {
      const next: Record<string, string> = { ...(previous as Record<string, string>) };
      for (const [key, value] of Object.entries(patch)) {
        if (!value || value === INHERIT || value === "default") delete next[key];
        else next[key] = value;
      }
      return next as PageLayout;
    });
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveEntryLayoutAction(entryId, layout);
      if (!result.success) {
        setStatus({ error: result.error.message });
        return;
      }
      setLayout(result.layout);
      setStatus(result.proposed ? "proposed" : "saved");
    });
  }

  const template = layout.template ?? "default";
  const templateSelectOptions: PageLayoutOption[] = [{ value: "default", label: "Padrão" }, ...templateOptions];
  if (!templateSelectOptions.some((option) => option.value === template)) {
    templateSelectOptions.push({ value: template, label: `${template} ${UNAVAILABLE_SUFFIX}` });
  }

  return (
    <section aria-labelledby="page-layout-title" className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="page-layout-title" className="text-xs font-medium text-muted-foreground/56 uppercase">
            Layout da página
          </h2>
          <p className="text-xs text-muted-foreground/56">Tema ativo: {themeLabel}</p>
        </div>
        <Button type="button" variant="outline" size="xs" onClick={handleSave} disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar layout"}
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <LayoutSelect id="page-layout-width" label="Largura" value={layout.width ?? INHERIT} options={WIDTH_OPTIONS} onChange={(width) => update({ width })} />
        <LayoutSelect id="page-layout-rail" label="Barra lateral (rail)" value={layout.rail ?? INHERIT} options={RAIL_OPTIONS} onChange={(rail) => update({ rail })} />
        <LayoutSelect
          id="page-layout-contextual"
          label="Barra contextual"
          value={layout.contextualBar ?? INHERIT}
          options={CONTEXTUAL_OPTIONS}
          onChange={(contextualBar) => update({ contextualBar })}
        />
        {templateSelectOptions.length > 1 && (
          <LayoutSelect
            id="page-layout-template"
            label="Variante de template"
            value={template}
            options={templateSelectOptions}
            onChange={(value) => update({ template: value })}
          />
        )}
      </div>
      {status === "saved" && <p className="mt-2 text-sm text-success">Layout salvo.</p>}
      {status === "proposed" && (
        <p className="mt-2 text-sm text-muted-foreground">Este conteúdo está publicado: o layout foi enviado como proposta e entra no ar quando um editor aplicar.</p>
      )}
      {status !== null && typeof status === "object" && <p className="mt-2 text-sm text-destructive">{status.error}</p>}
    </section>
  );
}
