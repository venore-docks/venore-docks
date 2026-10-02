import type { BlockDefinition, EditorField } from "@/contexts/cms/contracts/block-definition";
import type { ThemePageBuilderDeclaration, ThemeText } from "@/contexts/themes/contracts/v8";
import { CANONICAL_SECTION_STYLES } from "@/contexts/themes/contracts/v8/enums";
import { SECTION_BLOCK_KEY } from "./blocks/section";

// Nomes das chaves planas em block.data (spec §4.5).
export const PRESENTATION_VARIANT_FIELD = "presentationVariant";
export const SECTION_STYLE_FIELD = "sectionStyle";
// Sufixo do rótulo de um valor guardado que o tema ativo não oferece (o editor acrescenta a opção
// com este rótulo pra não "apagar" a escolha só por trocar de tema).
export const UNAVAILABLE_IN_THEME_SUFFIX = "(indisponível neste tema)";

const CANONICAL_SECTION_STYLE_LABELS: Record<string, string> = {
  default: "Padrão",
  muted: "Suave",
  brand: "Marca",
  inverted: "Invertido",
  accent: "Acento",
};

export type ThemeTextResolver = (text: ThemeText) => string;

const literalText: ThemeTextResolver = (text) => (typeof text === "string" ? text : text.messageKey);

// Acrescenta o campo "Aparência" (variante do tema, data.presentationVariant) aos blocos com
// variantes declaradas e o "Estilo da seção" (data.sectionStyle) ao bloco Seção — sempre em
// CÓPIAS (spec §7.15): o registro do core nunca é mutado, e dois temas no mesmo processo não se
// enxergam. `resolveText` traduz o ThemeText do manifesto (chave de catálogo → texto).
export function withThemePresentationFields(
  definitions: readonly BlockDefinition[],
  pageBuilder: Required<ThemePageBuilderDeclaration>,
  resolveText: ThemeTextResolver = literalText,
): BlockDefinition[] {
  const extraLabels = new Map(pageBuilder.sectionStyles.map((style) => [style.value, resolveText(style.label)]));

  return definitions.map((definition) => {
    const editorFields: EditorField[] = definition.editorFields
      .filter((field) => field.name !== PRESENTATION_VARIANT_FIELD && field.name !== SECTION_STYLE_FIELD)
      .map((field) => ({ ...field, options: field.options?.map((option) => ({ ...option })) }));

    const variants = (pageBuilder.blockVariants[definition.key] ?? []).filter((variant) => variant.value !== "default");
    if (variants.length > 0) {
      editorFields.push({
        name: PRESENTATION_VARIANT_FIELD,
        type: "select",
        label: "Aparência",
        options: [{ value: "default", label: "Padrão" }, ...variants.map((variant) => ({ value: variant.value, label: resolveText(variant.label) }))],
      });
    }

    if (definition.key === SECTION_BLOCK_KEY) {
      editorFields.push({
        name: SECTION_STYLE_FIELD,
        type: "select",
        label: "Estilo da seção",
        options: availableSectionStyles(pageBuilder).map((value) => ({
          value,
          label: CANONICAL_SECTION_STYLE_LABELS[value] ?? extraLabels.get(value) ?? value,
        })),
      });
    }

    return {
      ...definition,
      defaultData: { ...definition.defaultData },
      editorFields,
      areaDefinitions: definition.areaDefinitions?.map((area) => ({ ...area, allowedBlockKeys: [...area.allowedBlockKeys] })),
      requiredDataFields: definition.requiredDataFields ? [...definition.requiredDataFields] : undefined,
    };
  });
}

// Opções de um select com o valor guardado garantido: se o tema ativo não oferece `value`, ele
// entra rotulado "(indisponível neste tema)" — exibido, nunca reescrito sozinho.
export function withUnavailableOption(
  options: readonly { value: string; label: string }[],
  value: string,
): { value: string; label: string }[] {
  if (value.length === 0 || options.some((option) => option.value === value)) return [...options];
  return [...options, { value, label: `${value} ${UNAVAILABLE_IN_THEME_SUFFIX}` }];
}

// Estilos de seção oferecidos pelo tema: canônicos − escondidos + extras declarados (spec §7.15).
// "default" é sempre oferecido (não pode ser escondido).
export function availableSectionStyles(pageBuilder: Required<ThemePageBuilderDeclaration>): string[] {
  const hidden = new Set<string>(pageBuilder.hideSectionStyles.filter((style) => style !== "default"));
  const canonical = CANONICAL_SECTION_STYLES.filter((style) => !hidden.has(style));
  const extras = pageBuilder.sectionStyles.map((style) => style.value).filter((value) => !canonical.includes(value as never));
  return [...canonical, ...new Set(extras)];
}

// Valor guardado em data.sectionStyle → estilo efetivo. Desconhecido/escondido/ausente → "default".
export function resolveSectionStyle(value: unknown, pageBuilder: Required<ThemePageBuilderDeclaration>): string {
  if (typeof value !== "string" || value.length === 0) return "default";
  return availableSectionStyles(pageBuilder).includes(value) ? value : "default";
}
