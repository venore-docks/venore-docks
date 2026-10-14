import { z } from "zod";
import type { SchemaFormField, SchemaFormValues } from "@/components/schema-form/types";
import {
  FONT_IDS,
  type FontId,
  type FontRole,
  FONT_ROLES,
  RESERVED_THEME_OPTION_KEYS,
  THEME_COLOR_VALUE_PATTERN,
  THEME_OPTION_KEY_PATTERN,
  type ResolvedThemeDefinition,
  type ThemeMessages,
  type ThemeOptionField,
  type ThemeOptionValue,
  type ThemeText,
} from "@/contexts/themes/contracts/v8";

// Opções declaradas pelo tema (spec v8 §2.3) — o "schema" do manifesto vira validador zod aqui.
// Módulo puro (sem IO): usado pelo render (resolve-theme-options), pela escrita
// (validate-theme-config, action de opções) e pelo admin (schema-form). Duas camadas:
//   1. a DECLARAÇÃO (o campo no manifesto do tema) — `themeOptionFieldSchema`/`validateThemeOptionFields`;
//   2. o VALOR salvo para um campo — `themeOptionValueSchema(field)`/`isValidOptionValue`.

export const THEME_OPTION_RANGE_UNITS = ["", "rem", "px", "%", "ms", "deg"] as const;
// Valor de select vira atributo `data-opt-<key>="<valor>"` e seletor de CSS no theme.css do tema:
// só minúsculas, dígitos e hífen (mesma regra do PreviewBridge), nada que precise de escape.
export const THEME_OPTION_ATTRIBUTE_VALUE_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
// Id de mídia guardado numa opção `media` (uuid/nanoid): nunca entra em CSS, só em URL codificada.
export const THEME_OPTION_MEDIA_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const THEME_OPTION_TEXT_MAX_LENGTH = 2048;
// Tolerância de ponto flutuante pra "valor cai num passo" (0.1 + 0.2 ≠ 0.3).
const RANGE_STEP_EPSILON = 1e-6;

// ── 1. Declaração ────────────────────────────────────────────────────────────────────────────

const themeTextSchema = z.union([z.string().min(1).max(200), z.object({ messageKey: z.string().min(1).max(120) }).strict()]);
const optionKeySchema = z
  .string()
  .regex(THEME_OPTION_KEY_PATTERN, "chave fora do padrão [a-z][a-z0-9-]{0,31}")
  .refine((key) => !RESERVED_THEME_OPTION_KEYS.includes(key), "chave reservada (layout, mobile-nav, contextual-bar)");
const baseShape = {
  key: optionKeySchema,
  label: themeTextSchema,
  description: themeTextSchema.optional(),
  group: z.string().min(1).max(60).optional(),
  when: z.object({ key: z.string().regex(THEME_OPTION_KEY_PATTERN), equals: z.union([z.string(), z.boolean()]) }).strict().optional(),
};

export const themeOptionFieldSchema = z.discriminatedUnion("type", [
  z.object({ ...baseShape, type: z.literal("boolean"), default: z.boolean() }).strict(),
  z
    .object({
      ...baseShape,
      type: z.literal("select"),
      default: z.string(),
      choices: z
        .array(z.object({ value: z.string().regex(THEME_OPTION_ATTRIBUTE_VALUE_PATTERN), label: themeTextSchema }).strict())
        .min(1)
        .max(50),
    })
    .strict()
    .refine((field) => field.choices.some((choice) => choice.value === field.default), "o padrão não está entre as escolhas")
    .refine((field) => new Set(field.choices.map((choice) => choice.value)).size === field.choices.length, "escolha repetida"),
  z
    .object({
      ...baseShape,
      type: z.literal("range"),
      default: z.number().finite(),
      min: z.number().finite(),
      max: z.number().finite(),
      step: z.number().finite().positive(),
      unit: z.enum(THEME_OPTION_RANGE_UNITS),
    })
    .strict()
    .refine((field) => field.min <= field.max, "min maior que max")
    .refine((field) => isInRange(field, field.default), "o padrão está fora de min/max/step"),
  z.object({ ...baseShape, type: z.literal("color"), default: z.string().regex(THEME_COLOR_VALUE_PATTERN) }).strict(),
  z.object({ ...baseShape, type: z.literal("font"), role: z.enum(FONT_ROLES as [string, ...string[]]), default: z.enum(FONT_IDS).optional() }).strict(),
  z
    .object({ ...baseShape, type: z.literal("text"), default: z.string(), maxLength: z.number().int().min(1).max(THEME_OPTION_TEXT_MAX_LENGTH) })
    .strict()
    .refine((field) => field.default.length <= field.maxLength, "o padrão passa de maxLength"),
  z.object({ ...baseShape, type: z.literal("media"), accept: z.literal("image") }).strict(),
]);

export type ThemeOptionFieldsValidation = { fields: ThemeOptionField[]; errors: string[] };

// Valida as declarações de um tema (registro/CI: "option defaults validate", spec §10). Campo
// inválido é descartado com erro; `when` apontando pra chave inexistente também é erro.
export function validateThemeOptionFields(fields: readonly unknown[]): ThemeOptionFieldsValidation {
  const errors: string[] = [];
  const valid: ThemeOptionField[] = [];
  const seen = new Set<string>();
  fields.forEach((candidate, index) => {
    const parsed = themeOptionFieldSchema.safeParse(candidate);
    const label = typeof (candidate as { key?: unknown })?.key === "string" ? `"${(candidate as { key: string }).key}"` : `#${index}`;
    if (!parsed.success) {
      errors.push(`Opção ${label}: ${parsed.error.issues[0]?.message ?? "declaração inválida"}.`);
      return;
    }
    if (seen.has(parsed.data.key)) {
      errors.push(`Opção ${label}: chave repetida.`);
      return;
    }
    seen.add(parsed.data.key);
    valid.push(parsed.data as ThemeOptionField);
  });
  for (const field of valid) {
    if (field.when && !seen.has(field.when.key)) errors.push(`Opção "${field.key}": when.key "${field.when.key}" não é uma opção declarada.`);
  }
  return { fields: valid, errors };
}

// ── 2. Valor ─────────────────────────────────────────────────────────────────────────────────

function isInRange(field: { min: number; max: number; step: number }, value: number): boolean {
  if (!Number.isFinite(value) || value < field.min || value > field.max) return false;
  const steps = (value - field.min) / field.step;
  return Math.abs(steps - Math.round(steps)) < RANGE_STEP_EPSILON;
}

// Validador zod do VALOR de um campo (sem `null`: null = "volta ao padrão", tratado por quem chama).
export function themeOptionValueSchema(field: ThemeOptionField): z.ZodType<ThemeOptionValue> {
  switch (field.type) {
    case "boolean":
      return z.boolean();
    case "select":
      return z.string().refine((value) => field.choices.some((choice) => choice.value === value), "escolha não oferecida pelo tema");
    case "range":
      return z.number().refine((value) => isInRange(field, value), `fora do intervalo ${field.min}–${field.max} (passo ${field.step})`);
    case "color":
      return z.string().regex(THEME_COLOR_VALUE_PATTERN, "cor inválida (use #rrggbb ou oklch(L C H))");
    case "font":
      return z.enum(FONT_IDS);
    case "text":
      return z.string().max(field.maxLength, `no máximo ${field.maxLength} caracteres`);
    case "media":
      return z.string().regex(THEME_OPTION_MEDIA_ID_PATTERN, "id de mídia inválido");
  }
}

// Schema do objeto de opções inteiro de um tema: só chaves declaradas, cada uma com seu validador
// (null permitido = padrão). Chave desconhecida reprova (`.strict()`).
export function buildThemeOptionsSchema(fields: readonly ThemeOptionField[]) {
  return z
    .object(Object.fromEntries(fields.map((field) => [field.key, themeOptionValueSchema(field).nullable().optional()])))
    .strict();
}

export function isValidOptionValue(field: ThemeOptionField, value: ThemeOptionValue): boolean {
  if (value === null) return true;
  return themeOptionValueSchema(field).safeParse(value).success;
}

export function themeOptionDefault(field: ThemeOptionField): ThemeOptionValue {
  switch (field.type) {
    case "font":
      return field.default ?? null;
    case "media":
      return null;
    default:
      return field.default;
  }
}

// Chaves reservadas (spec §2.3): não são campos declarados; valem só quando o tema oferece a
// escolha (presetChoices / mobileNavChoices). Quem lê é o ThemeRenderer (W3, resolveArrangement).
export const THEME_CONTEXTUAL_BAR_CHOICES = ["side", "top", "none"] as const;

export function isReservedThemeOptionKey(key: string): boolean {
  return RESERVED_THEME_OPTION_KEYS.includes(key);
}

export function isValidReservedOptionValue(
  theme: Pick<ResolvedThemeDefinition, "layoutDecl" | "responsive">,
  key: string,
  value: ThemeOptionValue,
): boolean {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  if (key === "layout") return (theme.layoutDecl.presetChoices as readonly string[]).includes(value);
  if (key === "mobile-nav") return (theme.responsive.mobileNavChoices as readonly string[]).includes(value);
  if (key === "contextual-bar") return (THEME_CONTEXTUAL_BAR_CHOICES as readonly string[]).includes(value);
  return false;
}

// ── 3. FormData (action de opções / schema-form) ─────────────────────────────────────────────

export const THEME_OPTION_FORM_PREFIX = "option.";
export const themeOptionFormName = (key: string) => `${THEME_OPTION_FORM_PREFIX}${key}`;

export type ThemeOptionsFormParse =
  | { success: true; values: Record<string, ThemeOptionValue> }
  | { success: false; fieldErrors: Record<string, string> };

// Lê um formulário gerado do schema (nomes `option.<key>`). Checkbox ausente = false; campo vazio
// de cor/fonte/mídia = null (padrão do tema). Qualquer valor inválido reprova o formulário inteiro,
// com a mensagem por campo — nada parcial é gravado.
export function parseThemeOptionsFormData(fields: readonly ThemeOptionField[], formData: FormData): ThemeOptionsFormParse {
  const values: Record<string, ThemeOptionValue> = {};
  const fieldErrors: Record<string, string> = {};
  for (const field of fields) {
    const raw = formData.get(themeOptionFormName(field.key));
    if (raw !== null && typeof raw !== "string") {
      fieldErrors[field.key] = "valor inválido";
      continue;
    }
    let value: ThemeOptionValue;
    if (field.type === "boolean") value = raw === "on" || raw === "true";
    else if (field.type === "range") value = raw === null || raw.trim() === "" ? null : Number(raw);
    else if (field.type === "text") value = raw ?? "";
    else value = raw === null || raw === "" ? null : raw;

    if (value !== null) {
      const parsed = themeOptionValueSchema(field).safeParse(value);
      if (!parsed.success) {
        fieldErrors[field.key] = parsed.error.issues[0]?.message ?? "valor inválido";
        continue;
      }
    }
    values[field.key] = value;
  }
  return Object.keys(fieldErrors).length > 0 ? { success: false, fieldErrors } : { success: true, values };
}

// ── 4. Texto do tema ─────────────────────────────────────────────────────────────────────────

// `ThemeText` literal ou chave do catálogo do tema (locale → fallback pt-BR → a própria chave).
export function resolveThemeText(text: ThemeText | undefined, messages?: ThemeMessages, locale = "pt-BR"): string {
  if (text === undefined) return "";
  if (typeof text === "string") return text;
  return messages?.[locale]?.[text.messageKey] ?? messages?.["pt-BR"]?.[text.messageKey] ?? text.messageKey;
}

// Campo visível dado o estado atual (`when`): escondido não é validado como obrigatório nem
// emitido de forma diferente — só some do formulário.
export function isThemeOptionVisible(field: ThemeOptionField, values: Readonly<Record<string, ThemeOptionValue>>): boolean {
  if (!field.when) return true;
  return values[field.when.key] === field.when.equals;
}

// ── 5. Formulário (schema-form) ──────────────────────────────────────────────────────────────

function fontLabel(id: string): string {
  return id
    .split("-")
    .map((part) => (/^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}

export type ThemeOptionsFormSource = {
  options: readonly ThemeOptionField[];
  messages?: ThemeMessages;
  fontChoices?: Partial<Record<FontRole, readonly FontId[]>>;
};

// Campos declarados → campos do formulário genérico (src/components/schema-form). O nome no
// FormData é `option.<key>` (o que parseThemeOptionsFormData lê).
export function toSchemaFormFields(theme: ThemeOptionsFormSource, locale = "pt-BR"): SchemaFormField[] {
  const text = (value: ThemeText | undefined) => resolveThemeText(value, theme.messages, locale);
  return theme.options.map((field): SchemaFormField => {
    const base = {
      name: themeOptionFormName(field.key),
      label: text(field.label) || field.key,
      description: field.description ? text(field.description) : undefined,
      group: field.group,
      visibleWhen: field.when ? { name: themeOptionFormName(field.when.key), equals: field.when.equals } : undefined,
    };
    switch (field.type) {
      case "boolean":
        return { ...base, type: "boolean" };
      case "select":
        return { ...base, type: "select", choices: field.choices.map((choice) => ({ value: choice.value, label: text(choice.label) || choice.value })) };
      case "range":
        return { ...base, type: "range", min: field.min, max: field.max, step: field.step, unit: field.unit };
      case "color":
        return { ...base, type: "color" };
      case "font": {
        const offered = theme.fontChoices?.[field.role] ?? FONT_IDS;
        return { ...base, type: "select", emptyLabel: "Padrão do tema", choices: offered.map((id) => ({ value: id, label: fontLabel(id) })) };
      }
      case "text":
        return { ...base, type: "text", maxLength: field.maxLength, multiline: field.maxLength > 120 };
      case "media":
        return { ...base, type: "media", accept: "image" };
    }
  });
}

// Valores efetivos (padrão ← salvo) no formato do formulário, por `option.<key>`. Valor salvo
// inválido não aparece no formulário (vale o padrão, como no render).
export function toSchemaFormValues(fields: readonly ThemeOptionField[], stored: Readonly<Record<string, ThemeOptionValue>> | undefined): SchemaFormValues {
  const values: Record<string, ThemeOptionValue> = {};
  for (const field of fields) {
    const saved = stored?.[field.key];
    values[themeOptionFormName(field.key)] = saved !== undefined && saved !== null && isValidOptionValue(field, saved) ? saved : themeOptionDefault(field);
  }
  return values;
}
