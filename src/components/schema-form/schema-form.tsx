"use client";

import { useId, useState, type ReactNode } from "react";
import { MediaPickerField } from "@/components/media-picker-field";
import type { SchemaFormField, SchemaFormValue, SchemaFormValues } from "./types";

// Mesmo visual dos campos nativos do admin (selects de admin/community, painéis do Personalizar).
const FIELD_CLASS =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";
const TEXTAREA_CLASS =
  "min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";
const LABEL_CLASS = "block text-xs font-medium text-muted-foreground";
const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

export type SchemaFormProps = {
  fields: readonly SchemaFormField[];
  // Valores iniciais (não controlado) ou atuais (controlado, com `onChange`).
  values: SchemaFormValues;
  onChange?: (name: string, value: SchemaFormValue) => void;
  // Mensagem de erro por `name` (validação do servidor): aria-invalid + aria-describedby.
  errors?: Readonly<Record<string, string>>;
  // Prefixo dos ids (dois formulários na mesma página não colidem).
  idPrefix?: string;
  disabled?: boolean;
};

function fieldId(prefix: string, name: string): string {
  return `${prefix}-${name.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

function asString(value: SchemaFormValue | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function isVisible(field: SchemaFormField, values: SchemaFormValues): boolean {
  if (!field.visibleWhen) return true;
  return values[field.visibleWhen.name] === field.visibleWhen.equals;
}

// Campo escondido por `visibleWhen` continua mandando o valor atual (o formulário não "apaga"
// o que não está à vista). Boolean falso = ausente, como um checkbox desmarcado.
function HiddenValue({ field, value }: { field: SchemaFormField; value: SchemaFormValue | undefined }) {
  if (value === null || value === undefined || value === false) return null;
  return <input type="hidden" name={field.name} value={field.type === "boolean" ? "true" : String(value)} />;
}

export function SchemaForm({ fields, values: externalValues, onChange, errors = {}, idPrefix, disabled }: SchemaFormProps) {
  const generatedId = useId();
  const prefix = idPrefix ?? `schema-form${generatedId.replace(/[^A-Za-z0-9_-]/g, "")}`;
  const controlled = onChange !== undefined;
  const [localValues, setLocalValues] = useState<SchemaFormValues>(externalValues);
  const values = controlled ? externalValues : localValues;

  const setValue = (name: string, value: SchemaFormValue) => {
    if (controlled) onChange(name, value);
    else setLocalValues((previous) => ({ ...previous, [name]: value }));
  };

  // Agrupa preservando a ordem de declaração: campos sem grupo saem soltos.
  const blocks: { group: string | null; fields: SchemaFormField[] }[] = [];
  for (const field of fields) {
    const group = field.group ?? null;
    const last = blocks.at(-1);
    if (last && last.group === group) last.fields.push(field);
    else blocks.push({ group, fields: [field] });
  }

  const renderField = (field: SchemaFormField) =>
    isVisible(field, values) ? (
      <FieldControl
        key={field.name}
        field={field}
        id={fieldId(prefix, field.name)}
        value={values[field.name]}
        error={errors[field.name]}
        disabled={disabled}
        onChange={(value) => setValue(field.name, value)}
      />
    ) : (
      <HiddenValue key={field.name} field={field} value={values[field.name]} />
    );

  return (
    <div className="space-y-4">
      {blocks.map((block, index) =>
        block.group ? (
          <fieldset key={`${block.group}-${index}`} className="space-y-3 border-t border-border pt-3">
            <legend className="pe-2 text-xs font-semibold text-foreground">{block.group}</legend>
            {block.fields.map(renderField)}
          </fieldset>
        ) : (
          <div key={`ungrouped-${index}`} className="space-y-3">
            {block.fields.map(renderField)}
          </div>
        ),
      )}
    </div>
  );
}

function FieldControl({
  field,
  id,
  value,
  error,
  disabled,
  onChange,
}: {
  field: SchemaFormField;
  id: string;
  value: SchemaFormValue | undefined;
  error: string | undefined;
  disabled: boolean | undefined;
  onChange: (value: SchemaFormValue) => void;
}) {
  const descriptionId = field.description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
  const a11y = { "aria-describedby": describedBy, "aria-invalid": error ? true : undefined } as const;

  const footer: ReactNode = (
    <>
      {field.description && (
        <p id={descriptionId} className="mt-1 text-xs text-muted-foreground">
          {field.description}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </>
  );
  const label = (
    <label htmlFor={id} className={LABEL_CLASS}>
      {field.label}
    </label>
  );

  switch (field.type) {
    case "boolean":
      return (
        <div>
          <div className="flex items-center gap-2">
            <input
              id={id}
              type="checkbox"
              name={field.name}
              value="true"
              checked={value === true}
              disabled={disabled}
              onChange={(event) => onChange(event.target.checked)}
              className="size-4 accent-primary"
              {...a11y}
            />
            <label htmlFor={id} className="text-sm text-foreground">
              {field.label}
            </label>
          </div>
          {footer}
        </div>
      );
    case "select":
      return (
        <div>
          {label}
          <select
            id={id}
            name={field.name}
            value={asString(value)}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
            className={`mt-1 ${FIELD_CLASS}`}
            {...a11y}
          >
            {field.emptyLabel !== undefined && <option value="">{field.emptyLabel}</option>}
            {field.choices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
          {footer}
        </div>
      );
    case "range": {
      const numeric = typeof value === "number" ? value : field.min;
      const outputId = `${id}-output`;
      return (
        <div>
          <div className="flex items-baseline justify-between gap-2">
            {label}
            <output id={outputId} htmlFor={id} className="text-xs tabular-nums text-foreground">
              {numeric}
              {field.unit}
            </output>
          </div>
          <input
            id={id}
            type="range"
            name={field.name}
            min={field.min}
            max={field.max}
            step={field.step}
            value={numeric}
            disabled={disabled}
            aria-valuetext={`${numeric}${field.unit ?? ""}`}
            onChange={(event) => onChange(Number(event.target.value))}
            className="mt-1 w-full accent-primary"
            {...a11y}
          />
          {footer}
        </div>
      );
    }
    case "color": {
      const text = asString(value);
      return (
        <div>
          {label}
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              aria-label={`${field.label} (seletor)`}
              value={HEX_PATTERN.test(text) ? text : "#000000"}
              disabled={disabled}
              onChange={(event) => onChange(event.target.value)}
              className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-input bg-transparent"
            />
            <input
              id={id}
              type="text"
              name={field.name}
              value={text}
              placeholder={field.placeholder ?? "#rrggbb ou oklch(L C H)"}
              spellCheck={false}
              autoComplete="off"
              disabled={disabled}
              onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
              className={FIELD_CLASS}
              {...a11y}
            />
          </div>
          {footer}
        </div>
      );
    }
    case "text":
      return (
        <div>
          {label}
          {field.multiline ? (
            <textarea
              id={id}
              name={field.name}
              value={asString(value)}
              maxLength={field.maxLength}
              disabled={disabled}
              onChange={(event) => onChange(event.target.value)}
              className={`mt-1 ${TEXTAREA_CLASS}`}
              {...a11y}
            />
          ) : (
            <input
              id={id}
              type="text"
              name={field.name}
              value={asString(value)}
              maxLength={field.maxLength}
              disabled={disabled}
              onChange={(event) => onChange(event.target.value)}
              className={`mt-1 ${FIELD_CLASS}`}
              {...a11y}
            />
          )}
          {footer}
        </div>
      );
    case "media": {
      const mediaId = asString(value);
      return (
        <div role="group" aria-labelledby={`${id}-label`} {...a11y}>
          <p id={`${id}-label`} className={LABEL_CLASS}>
            {field.label}
          </p>
          {/* O picker tem o próprio hidden (vazio até escolher); o valor de verdade é este. */}
          <input type="hidden" name={field.name} value={mediaId} />
          <MediaPickerField name={`${field.name}.__picker`} label={field.label} onSelect={(media) => onChange(media?.id ?? null)} />
          {mediaId && (
            <p className="mt-1 text-xs text-muted-foreground">
              Atual: <code>{mediaId}</code>{" "}
              <button type="button" className="text-primary underline" disabled={disabled} onClick={() => onChange(null)}>
                remover
              </button>
            </p>
          )}
          {footer}
        </div>
      );
    }
  }
}
