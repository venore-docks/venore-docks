import type { AreaDefinition, BlockDefinition, ResolveBlockDefinition } from "@/contexts/cms";
import { PLUGIN_CONTRIBUTIONS } from "@/plugins/contributions";
import { buttonBlockDefinition } from "./blocks/button";
import { headingBlockDefinition } from "./blocks/heading";
import { imageBlockDefinition } from "./blocks/image";
import { createRowBlockDefinition } from "./blocks/row";
import { richtextBlockDefinition } from "./blocks/richtext";
import { spacerBlockDefinition } from "./blocks/spacer";
import { dividerBlockDefinition } from "./blocks/divider";
import { iconBlockDefinition } from "./blocks/icon";
import { badgeBlockDefinition } from "./blocks/badge";
import { quoteBlockDefinition } from "./blocks/quote";
import { alertBlockDefinition } from "./blocks/alert";
import { listBlockDefinition } from "./blocks/list";
import { progressBlockDefinition } from "./blocks/progress";
import { cardBlockDefinition } from "./blocks/card";
import { audioBlockDefinition } from "./blocks/audio";
import { createSectionBlockDefinition } from "./blocks/section";
import { accordionBlockDefinition } from "./blocks/accordion";
import { createAccordionItemBlockDefinition } from "./blocks/accordion-item";
import { tabsBlockDefinition } from "./blocks/tabs";
import { createTabsItemBlockDefinition } from "./blocks/tabs-item";
import { cardGridBlockDefinition } from "./blocks/card-grid";
import { heroBlockDefinition } from "./blocks/hero";
import { ctaBlockDefinition } from "./blocks/cta";
import { galleryBlockDefinition } from "./blocks/gallery";
import { carouselBlockDefinition } from "./blocks/carousel";

const CORE_LEAF_BLOCKS: BlockDefinition[] = [
  headingBlockDefinition,
  richtextBlockDefinition,
  imageBlockDefinition,
  buttonBlockDefinition,
  spacerBlockDefinition,
  dividerBlockDefinition,
  iconBlockDefinition,
  badgeBlockDefinition,
  quoteBlockDefinition,
  alertBlockDefinition,
  listBlockDefinition,
  progressBlockDefinition,
  cardBlockDefinition,
  audioBlockDefinition,
  heroBlockDefinition,
  ctaBlockDefinition,
];

// contexts/cms não conhece plugin nenhum (regra de boundary da sessão) — este registry mora em
// platform/ e lê PLUGIN_CONTRIBUTIONS (src/plugins/contributions.generated.ts, agregado pelo
// codegen a partir dos plugins presentes). Um plugin que contribui blocos declara
// `blockDefinitions: BlockDefinition[]` (dado puro, serializável) no `contributions.ts` dele —
// nunca lido por scan de filesystem em runtime, e um plugin ausente simplesmente não aparece no
// mapa.
const PLUGIN_BLOCK_BARRELS: Record<string, { blockDefinitions?: BlockDefinition[] }> = Object.fromEntries(
  Object.entries(PLUGIN_CONTRIBUTIONS).map(([key, contributions]) => [
    key,
    { blockDefinitions: contributions.blockDefinitions },
  ]),
);

// Owner (plugin key) de cada block key contribuída por plugin — usado pra filtrar por plugin
// ativo em listBlockDefinitions(activePluginKeys) e pra gate no dispatch de render
// (pluginKeyForBlockKey, consumido por components/page-builder/block-renderer.tsx). A montagem
// interna abaixo continua somando TODA block key instalada de propósito: as áreas aninhadas
// (row/section/accordion-item...) precisam conhecer as keys pra validar composição já autorada
// enquanto o plugin estava ativo — o filtro por ativo é do palette e do render, não da montagem.
const PLUGIN_KEY_BY_BLOCK_KEY = new Map<string, string>(
  Object.entries(PLUGIN_BLOCK_BARRELS).flatMap(([pluginKey, barrel]) =>
    (barrel.blockDefinitions ?? []).map((definition) => [definition.key, pluginKey] as const),
  ),
);

export function pluginKeyForBlockKey(blockKey: string): string | null {
  return PLUGIN_KEY_BY_BLOCK_KEY.get(blockKey) ?? null;
}

function collectPluginBlocks(): BlockDefinition[] {
  return Object.values(PLUGIN_BLOCK_BARRELS).flatMap((barrel) => barrel.blockDefinitions ?? []);
}

// Block keys de plugin que NÃO estão ativos agora — o que listBlockDefinitions remove do palette.
function inactivePluginBlockKeys(activePluginKeys: ReadonlySet<string>): Set<string> {
  return new Set(
    [...PLUGIN_KEY_BY_BLOCK_KEY].filter(([, pluginKey]) => !activePluginKeys.has(pluginKey)).map(([blockKey]) => blockKey),
  );
}

function withoutBlockKeys(definition: BlockDefinition, excluded: ReadonlySet<string>): BlockDefinition {
  if (!definition.areaDefinitions?.some((area) => area.allowedBlockKeys.some((key) => excluded.has(key)))) {
    return definition;
  }
  const areaDefinitions: AreaDefinition[] = definition.areaDefinitions.map((area) => ({
    ...area,
    allowedBlockKeys: area.allowedBlockKeys.filter((key) => !excluded.has(key)),
  }));
  return { ...definition, areaDefinitions };
}

// Ordem de montagem importa: cada fábrica só conhece as keys já resolvidas antes dela.
// 1) leaf (core + plugin) — sem dependência de nada.
const leafBlocks: BlockDefinition[] = [...CORE_LEAF_BLOCKS, ...collectPluginBlocks()];
const leafBlockKeys = leafBlocks.map((block) => block.key);

// 2) accordion-item/tabs-item — área de conteúdo aceita só leaf/plugin (sem blocos estruturais
// aninhados nesta primeira versão, ver comentário em accordion-item.ts).
const accordionItemBlockDefinition = createAccordionItemBlockDefinition(leafBlockKeys);
const tabsItemBlockDefinition = createTabsItemBlockDefinition(leafBlockKeys);

// 3) accordion/tabs/card-grid — allowedBlockKeys fixo (só aceitam seu próprio bloco-item), não
// precisam de fábrica.
const structuralItemBlocks: BlockDefinition[] = [
  accordionBlockDefinition,
  accordionItemBlockDefinition,
  tabsBlockDefinition,
  tabsItemBlockDefinition,
  cardGridBlockDefinition,
  galleryBlockDefinition,
  carouselBlockDefinition,
];

// 4) row — "tudo menos row" (mesma regra de sempre), agora incluindo os blocos estruturais do
// passo 3.
const rowNestableKeys = [...leafBlockKeys, ...structuralItemBlocks.map((block) => block.key)];
const rowBlockDefinition = createRowBlockDefinition(rowNestableKeys);

// 5) section — "agrupa várias rows" (motivo de existir): sua área de conteúdo aceita tudo que row
// aceita, mais o próprio row.
const sectionNestableKeys = [...rowNestableKeys, rowBlockDefinition.key];
const sectionBlockDefinition = createSectionBlockDefinition(sectionNestableKeys);

const ALL_BLOCK_DEFINITIONS: BlockDefinition[] = [
  rowBlockDefinition,
  sectionBlockDefinition,
  ...leafBlocks,
  ...structuralItemBlocks,
];

const BLOCK_DEFINITIONS_BY_KEY = new Map(ALL_BLOCK_DEFINITIONS.map((block) => [block.key, block]));

// resolveBlockDefinition NÃO filtra por plugin ativo de propósito: publish/validate de uma entry
// que já tem um bloco de plugin hoje desativado precisa continuar reconhecendo a key (o
// block-renderer decide não renderizar; ver components/page-builder/block-renderer.tsx). Só o
// palette (listBlockDefinitions) e o dispatch de render aplicam o gate por plugin ativo.
export const resolveBlockDefinition: ResolveBlockDefinition = (key) => BLOCK_DEFINITIONS_BY_KEY.get(key) ?? null;

// activePluginKeys vem do loader da página do builder (getActivePluginKeys()); ausente == sem
// filtro (usado por testes de paridade e por chamadas que não têm request/relatório à mão). Com
// o set, um plugin desativado não contribui bloco nenhum pro palette — nem como opção de drop
// dentro de uma área aninhada (allowedBlockKeys também é podado).
export function listBlockDefinitions(activePluginKeys?: ReadonlySet<string>): BlockDefinition[] {
  if (!activePluginKeys) {
    return ALL_BLOCK_DEFINITIONS;
  }
  const excluded = inactivePluginBlockKeys(activePluginKeys);
  if (excluded.size === 0) {
    return ALL_BLOCK_DEFINITIONS;
  }
  return ALL_BLOCK_DEFINITIONS.filter((definition) => !excluded.has(definition.key)).map((definition) =>
    withoutBlockKeys(definition, excluded),
  );
}
