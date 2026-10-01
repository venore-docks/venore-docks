import type { BlockDefinition } from "@/contexts/cms/contracts/block-definition";
import type { ThemePageBuilderDeclaration } from "@/contexts/themes/contracts/v8";

// Acrescenta o campo "Aparência" (variante do tema) e o "Estilo da seção" às definições de bloco
// do editor — sempre em CÓPIAS (spec §7.15). Dono: W5 — na Fase F devolve cópias rasas sem campo
// novo (nenhum tema declara variantes).
export function withThemePresentationFields(
  definitions: readonly BlockDefinition[],
  pageBuilder: Required<ThemePageBuilderDeclaration>,
): BlockDefinition[] {
  void pageBuilder;
  return definitions.map((definition) => ({ ...definition }));
}
