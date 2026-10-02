"use client";

import type { Block, BlockDefinition, EditorField } from "@/contexts/cms";
import type { JSONContent } from "@tiptap/core";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IconPicker } from "@/components/icon-picker";
import { PRESENTATION_VARIANT_FIELD, SECTION_STYLE_FIELD, withUnavailableOption } from "@/platform/page-builder/with-theme-presentation-fields";
import { MediaField } from "./media-field";
import { RichTextField } from "./rich-text-field";

// Nada hardcoded por bloco: os campos vêm de definition.editorFields (pedido da sessão). Cada
// EditorFieldType vira um controle; blocos novos (plugins) ganham painel de edição de graça,
// sem tocar neste arquivo, desde que declarem editorFields.
function readString(data: Block["data"], name: string): string {
  const value = data[name];
  return typeof value === "string" ? value : "";
}

function readNumber(data: Block["data"], name: string): string {
  const value = data[name];
  return typeof value === "number" ? String(value) : "";
}

function readBoolean(data: Block["data"], name: string): boolean {
  return data[name] === true;
}

function readNullableString(data: Block["data"], name: string): string | null {
  const value = data[name];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readJSONContent(data: Block["data"], name: string): JSONContent | null {
  const value = data[name];
  return value && typeof value === "object" ? (value as JSONContent) : null;
}

// Campos de apresentação do tema (variante/estilo de seção): um valor guardado que o tema ativo
// não oferece aparece rotulado "(indisponível neste tema)" — nunca some nem é reescrito sozinho.
function selectOptions(field: EditorField, value: string): { value: string; label: string }[] {
  const options = field.options ?? [];
  if (field.name !== PRESENTATION_VARIANT_FIELD && field.name !== SECTION_STYLE_FIELD) return options;
  return withUnavailableOption(options, value);
}

// Alguns defaultData guardam número (ex: row.columns: 2) mesmo com editorField "select" (cujas
// options são sempre string) — normaliza pra exibição sem mexer no formato de data.
function readSelectValue(data: Block["data"], name: string): string {
  const value = data[name];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

export function BlockFieldsPanel({
  block,
  definition,
  errorMessage,
  onChange,
}: {
  block: Block;
  definition: BlockDefinition;
  errorMessage: string | null;
  onChange: (data: Record<string, unknown>) => void;
}) {
  function setField(name: string, value: unknown) {
    onChange({ ...block.data, [name]: value });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{definition.label}</h2>
        <p className="text-xs text-muted-foreground/56">{definition.category}</p>
      </div>

      {errorMessage && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">{errorMessage}</p>
      )}

      {definition.editorFields.length === 0 && <p className="text-sm text-muted-foreground/56">Este bloco não tem campos.</p>}

      {definition.editorFields.map((field) => (
        <FieldControl key={field.name} field={field} block={block} onChange={setField} />
      ))}
    </div>
  );
}

function FieldControl({
  field,
  block,
  onChange,
}: {
  field: EditorField;
  block: Block;
  onChange: (name: string, value: unknown) => void;
}) {
  const label = <label className="block text-xs font-medium text-muted-foreground">{field.label}</label>;

  switch (field.type) {
    case "text":
    case "url":
      return (
        <div>
          {label}
          <input
            type={field.type === "url" ? "url" : "text"}
            value={readString(block.data, field.name)}
            onChange={(event) => onChange(field.name, event.target.value)}
            className="mt-1 w-full rounded-md border border-border px-2 py-1 text-sm"
          />
        </div>
      );
    case "textarea":
      return (
        <div>
          {label}
          <textarea
            rows={4}
            value={readString(block.data, field.name)}
            onChange={(event) => onChange(field.name, event.target.value)}
            className="mt-1 w-full rounded-md border border-border px-2 py-1 text-sm"
          />
        </div>
      );
    case "richtext":
      return (
        <RichTextField
          label={field.label}
          value={readJSONContent(block.data, field.name)}
          onChange={(content) => onChange(field.name, content)}
        />
      );
    case "number":
      return (
        <div>
          {label}
          <input
            type="number"
            value={readNumber(block.data, field.name)}
            onChange={(event) => onChange(field.name, event.target.value === "" ? "" : Number(event.target.value))}
            className="mt-1 w-full rounded-md border border-border px-2 py-1 text-sm"
          />
        </div>
      );
    case "boolean":
      return (
        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <input
            type="checkbox"
            checked={readBoolean(block.data, field.name)}
            onChange={(event) => onChange(field.name, event.target.checked)}
          />
          {field.label}
        </label>
      );
    case "select":
      return (
        <div>
          {label}
          <Select
            value={readSelectValue(block.data, field.name)}
            onValueChange={(value) => onChange(field.name, value)}
          >
            <SelectTrigger className="mt-1 w-full">
              <SelectValue placeholder="selecione" />
            </SelectTrigger>
            <SelectContent>
              {selectOptions(field, readSelectValue(block.data, field.name)).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "icon":
      return (
        <div>
          {label}
          <div className="mt-1">
            <IconPicker
              value={readSelectValue(block.data, field.name)}
              onChange={(value) => onChange(field.name, value)}
              options={field.options ?? []}
            />
          </div>
        </div>
      );
    case "image":
      return (
        <MediaField
          label={field.label}
          value={readNullableString(block.data, field.name)}
          onChange={(mediaId) => onChange(field.name, mediaId)}
          accept="image/"
        />
      );
    case "audio":
      return (
        <MediaField
          label={field.label}
          value={readNullableString(block.data, field.name)}
          onChange={(mediaId) => onChange(field.name, mediaId)}
          accept="audio/"
        />
      );
    case "file":
      return (
        <MediaField
          label={field.label}
          value={readNullableString(block.data, field.name)}
          onChange={(mediaId) => onChange(field.name, mediaId)}
          accept=""
        />
      );
    default:
      return null;
  }
}
