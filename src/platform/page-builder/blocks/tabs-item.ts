import type { AreaDefinition, BlockDefinition } from "@/contexts/cms";

export const TABS_ITEM_BLOCK_KEY = "core.layout.tabs-item";

// Mesma restrição de conteúdo de accordion-item.ts (leaf/plugin, sem blocos estruturais aninhados
// nesta primeira versão).
export function createTabsItemBlockDefinition(contentBlockKeys: string[]): BlockDefinition {
  const areaDefinitions: AreaDefinition[] = [
    { key: "content", label: "Conteúdo", allowedBlockKeys: contentBlockKeys },
  ];

  return {
    key: TABS_ITEM_BLOCK_KEY,
    label: "Aba",
    category: "estrutura",
    structure: "areas",
    allowedInRoot: false,
    defaultData: { label: "Aba" },
    requiredDataFields: ["label"],
    missingConfigMessage: "Sem rótulo definido",
    editorFields: [
      { name: "label", type: "text", label: "Rótulo" },
      { name: "badge", type: "text", label: "Contador (opcional, ex.: 25)" },
    ],
    areaDefinitions,
  };
}
