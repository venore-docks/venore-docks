import type { ResolvedThemeDefinition, ThemeConfigDocument } from "@/contexts/themes/contracts/v8";

// Contrato comum dos painéis de /admin/themes/customize (spec v8 §9). Cada painel edita uma fatia
// do rascunho e devolve um patch; quem salva (saveThemeDraft) e recarrega o preview é a página
// (W6). Painéis são client components; `theme` é dado serializável.
export type DraftPanelProps<T = Partial<ThemeConfigDocument>> = {
  draft: ThemeConfigDocument;
  theme: ResolvedThemeDefinitionView;
  onChange: (patch: T) => void;
};

// Fatia serializável da definição resolvida que os painéis precisam (sem componentes/funções).
export type ResolvedThemeDefinitionView = Pick<
  ResolvedThemeDefinition,
  | "key"
  | "chain"
  | "contract"
  | "manifest"
  | "options"
  | "fonts"
  | "fontChoices"
  | "palette"
  | "colorPalettes"
  | "templateVariants"
  | "responsive"
  | "layoutDecl"
>;
