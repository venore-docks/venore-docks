"use client";

import { ChevronDownIcon, ChevronRightIcon, CopyIcon, PlusIcon, TrashIcon } from "lucide-react";
import type { Block, BlockDefinition, Composition } from "@/contexts/cms";
import { cn } from "@/lib/utils";
import { ROW_BLOCK_KEY, ROW_MAX_COLUMNS, resolveRowColumns } from "@/platform/page-builder/row-columns";

export type BlockTreeActions = {
  onSelect: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onAddSibling: (id: string) => void;
  onAddChild: (parentId: string, areaKey: string) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onSetColumns: (id: string, columns: number) => void;
};

// Mesma travessia pré-ordem de collectUnconfiguredBlockProblems em
// contexts/cms/features/entries/publish-entry/service.ts: contador global de rows, incrementado
// ao encontrar ROW_BLOCK_KEY, recursando em todas as areas de todo bloco — sem filtrar
// visível/oculto, pra "Linha N" na árvore bater com "Linha N" da mensagem de erro de publicação.
function buildRowNumberMap(blocks: Composition, counter: { value: number }, map: Map<string, number>): Map<string, number> {
  blocks.forEach((block) => {
    if (block.key === ROW_BLOCK_KEY) {
      counter.value += 1;
      map.set(block.id, counter.value);
    }
    block.areas.forEach((area) => buildRowNumberMap(area.blocks, counter, map));
  });
  return map;
}

export function BlockTree({
  blocks,
  definitionsByKey,
  selectedId,
  errorBlockId,
  collapsed,
  actions,
  rowNumbers,
}: {
  blocks: Composition;
  definitionsByKey: Map<string, BlockDefinition>;
  selectedId: string | null;
  errorBlockId: string | null;
  collapsed: Set<string>;
  actions: BlockTreeActions;
  rowNumbers?: Map<string, number>;
}) {
  if (blocks.length === 0) {
    return (
      <p className="pl-2 text-xs text-muted-foreground/56">
        Nenhum bloco aqui ainda. Use &quot;Adicionar bloco&quot; para começar esta área.
      </p>
    );
  }

  // rowNumbers ausente = chamada raiz (único call site: composition-builder.tsx) — computa a
  // numeração pra árvore inteira uma vez; chamadas recursivas (área -> BlockTree) sempre
  // recebem o mesmo Map já pronto.
  const resolvedRowNumbers = rowNumbers ?? buildRowNumberMap(blocks, { value: 0 }, new Map());

  return (
    <ul className="space-y-1">
      {blocks.map((block, index) => (
        <li key={block.id}>
          <BlockNode
            block={block}
            definition={definitionsByKey.get(block.key) ?? null}
            definitionsByKey={definitionsByKey}
            isFirst={index === 0}
            isLast={index === blocks.length - 1}
            selectedId={selectedId}
            errorBlockId={errorBlockId}
            collapsed={collapsed}
            actions={actions}
            rowNumbers={resolvedRowNumbers}
          />
        </li>
      ))}
    </ul>
  );
}

function BlockNode({
  block,
  definition,
  definitionsByKey,
  isFirst,
  isLast,
  selectedId,
  errorBlockId,
  collapsed,
  actions,
  rowNumbers,
}: {
  block: Block;
  definition: BlockDefinition | null;
  definitionsByKey: Map<string, BlockDefinition>;
  isFirst: boolean;
  isLast: boolean;
  selectedId: string | null;
  errorBlockId: string | null;
  collapsed: Set<string>;
  actions: BlockTreeActions;
  rowNumbers: Map<string, number>;
}) {
  const hasAreas = block.areas.length > 0;
  const isCollapsed = collapsed.has(block.id);
  const isSelected = selectedId === block.id;
  const hasError = errorBlockId === block.id;

  // Row só mostra as N primeiras colunas (mesma regra do render público) — bloco em coluna
  // oculta continua no dado, e o editor precisa deixar isso visível em vez de escondê-lo de vez.
  const isRow = block.key === ROW_BLOCK_KEY;
  const columns = isRow ? resolveRowColumns(block.data) : block.areas.length;
  const visibleAreas = isRow ? block.areas.slice(0, columns) : block.areas;
  const hiddenAreas = isRow ? block.areas.slice(columns) : [];
  const hiddenBlockCount = hiddenAreas.reduce((sum, area) => sum + area.blocks.length, 0);
  const nextColumns = Math.min(ROW_MAX_COLUMNS, columns + 1);
  const rowNumber = isRow ? rowNumbers.get(block.id) : undefined;
  const nodeLabel = definition?.label ?? "Bloco desconhecido";

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md border px-2 py-1.5",
          isSelected ? "border-primary bg-accent" : "border-transparent hover:border-border",
          hasError && "border-destructive",
        )}
      >
        {hasAreas ? (
          <button
            type="button"
            onClick={() => actions.onToggleCollapse(block.id)}
            className="rounded-sm text-muted-foreground/56 outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={isCollapsed ? "Expandir" : "Recolher"}
          >
            {isCollapsed ? <ChevronRightIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
          </button>
        ) : (
          <span className="w-3.5" />
        )}

        <button
          type="button"
          onClick={() => actions.onSelect(block.id)}
          className="flex-1 truncate rounded-sm text-left text-sm text-foreground outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring"
        >
          {rowNumber !== undefined ? `${nodeLabel} ${rowNumber}` : nodeLabel}
        </button>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            title="Mover para cima"
            disabled={isFirst}
            onClick={() => actions.onMove(block.id, "up")}
            className="rounded-md px-1 text-xs text-muted-foreground outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            title="Mover para baixo"
            disabled={isLast}
            onClick={() => actions.onMove(block.id, "down")}
            className="rounded-md px-1 text-xs text-muted-foreground outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            title="Adicionar irmão"
            onClick={() => actions.onAddSibling(block.id)}
            className="rounded-md px-1 text-muted-foreground outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PlusIcon className="size-3.5" />
          </button>
          <button
            type="button"
            title="Duplicar"
            onClick={() => actions.onDuplicate(block.id)}
            className="rounded-md px-1 text-muted-foreground outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CopyIcon className="size-3.5" />
          </button>
          <button
            type="button"
            title="Remover"
            onClick={() => actions.onRemove(block.id)}
            className="rounded-md px-1 text-destructive outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring"
          >
            <TrashIcon className="size-3.5" />
          </button>
        </div>
      </div>

      {hiddenBlockCount > 0 && (
        <div className="mt-1 ml-4 flex items-center justify-between gap-2 rounded-md border border-warning-border bg-warning-soft px-2 py-1 text-xs text-warning">
          <span>
            {hiddenBlockCount} bloco(s) em colunas ocultas.
          </span>
          <button
            type="button"
            onClick={() => actions.onSetColumns(block.id, nextColumns)}
            className="shrink-0 rounded-sm underline outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring"
          >
            Mostrar coluna {nextColumns}
          </button>
        </div>
      )}

      {hasAreas && !isCollapsed && (
        <div className="mt-1 ml-4 space-y-2 border-l border-border pl-3">
          {visibleAreas.map((area) => (
            <div key={area.key}>
              <div className="flex items-center justify-between">
                <p className="text-xs lg:text-[11px] font-medium text-muted-foreground/56 uppercase">
                  {definition?.areaDefinitions?.find((candidate) => candidate.key === area.key)?.label ?? area.key}
                </p>
                <button
                  type="button"
                  title="Adicionar bloco nesta area"
                  onClick={() => actions.onAddChild(block.id, area.key)}
                  className="rounded-sm text-muted-foreground/56 outline-none ui-motion-base hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <PlusIcon className="size-3.5" />
                </button>
              </div>
              <BlockTree
                blocks={area.blocks}
                definitionsByKey={definitionsByKey}
                selectedId={selectedId}
                errorBlockId={errorBlockId}
                collapsed={collapsed}
                actions={actions}
                rowNumbers={rowNumbers}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
