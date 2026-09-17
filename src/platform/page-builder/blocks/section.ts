import type { AreaDefinition, BlockDefinition } from "@/contexts/cms";
import { NAV_ICON_KEYS } from "@/platform/nav-icons/registry";

export const SECTION_BLOCK_KEY = "core.layout.section";

// Fábrica pelo mesmo motivo de createRowBlockDefinition (row.ts): allowedBlockKeys só é conhecido
// depois que o registry soma todos os blocos nesteáveis (core + plugin). Section funde os dois
// blocos "Section"/"Container" do TODO original — Container seria só um subconjunto dos campos de
// Section (largura máxima), não justifica um bloco à parte.
export function createSectionBlockDefinition(nestableBlockKeys: string[]): BlockDefinition {
  const areaDefinitions: AreaDefinition[] = [
    { key: "content", label: "Conteúdo", allowedBlockKeys: nestableBlockKeys },
  ];

  return {
    key: SECTION_BLOCK_KEY,
    label: "Seção",
    category: "estrutura",
    structure: "areas",
    allowedInRoot: true,
    defaultData: {
      background: "none",
      maxWidth: "full",
      paddingY: "md",
      paddingX: "md",
      title: "",
      icon: "",
      titleAlign: "start",
    },
    editorFields: [
      { name: "title", type: "text", label: "Título (opcional)" },
      {
        // Mesma allowlist do resto do app (platform/nav-icons/registry.ts) — reaproveitada, não
        // duplicada.
        name: "icon",
        type: "icon",
        label: "Ícone (opcional)",
        options: [{ value: "", label: "Nenhum" }, ...NAV_ICON_KEYS.map((name) => ({ value: name, label: name }))],
      },
      {
        // No desktop o ícone fica ao lado do título (linha); no mobile fica acima (coluna) —
        // mesmo padrão do bloco Aviso (IconTitleRow em block-renderers.tsx).
        name: "titleAlign",
        type: "select",
        label: "Alinhamento do título e ícone",
        options: [
          { value: "start", label: "Esquerda" },
          { value: "center", label: "Centro" },
          { value: "end", label: "Direita" },
        ],
      },
      {
        // panel/muted/secondary são cores "seguras" pra fundo cheio (baixo contraste, não brigam
        // com o texto dos blocos filhos, que não sabem que estão sobre um fundo colorido).
        // primary/accent/warning/success usam a variante -soft/opacidade fixa de cada token (nunca
        // sólido) — mesma regra de accent-soft já documentada em AGENTS.md (nunca bg-accent puro).
        name: "background",
        type: "select",
        label: "Fundo",
        options: [
          { value: "none", label: "Nenhum" },
          { value: "panel", label: "Painel" },
          { value: "muted", label: "Suave" },
          { value: "secondary", label: "Secundário" },
          { value: "primary", label: "Destaque (marca)" },
          { value: "accent", label: "Destaque (acento)" },
          { value: "warning", label: "Aviso" },
          { value: "success", label: "Sucesso" },
        ],
      },
      {
        name: "maxWidth",
        type: "select",
        label: "Largura máxima",
        options: [
          { value: "full", label: "Total" },
          { value: "7xl", label: "Extra larga" },
          { value: "5xl", label: "Larga" },
          { value: "3xl", label: "Estreita" },
        ],
      },
      {
        name: "paddingY",
        type: "select",
        label: "Espaçamento vertical",
        options: [
          { value: "none", label: "Nenhum" },
          { value: "xs", label: "Extra pequeno" },
          { value: "sm", label: "Pequeno" },
          { value: "md", label: "Médio" },
          { value: "lg", label: "Grande" },
          { value: "xl", label: "Extra grande" },
        ],
      },
      {
        // Faltava — Section com fundo (background acima) e maxWidth "Total" encostava o conteúdo
        // na borda da tela sem isso. Mesmo padrão de px-6 usado em ContentSlot/Breadcrumbs de
        // todos os temas, só que configurável por seção.
        name: "paddingX",
        type: "select",
        label: "Espaçamento horizontal",
        options: [
          { value: "none", label: "Nenhum" },
          { value: "xs", label: "Extra pequeno" },
          { value: "sm", label: "Pequeno" },
          { value: "md", label: "Médio" },
          { value: "lg", label: "Grande" },
          { value: "xl", label: "Extra grande" },
        ],
      },
    ],
    areaDefinitions,
  };
}
