"use client";

import { Layers, Shapes, type LucideIcon } from "lucide-react";
import type { BlockDefinition } from "@/contexts/cms";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Ordem estável (não insertion-order-dependent) e rótulo/ícone de exibição por categoria — a
// categoria em si (definition.category) continua sendo a chave de negócio (usada pra allowedIn*
// e afins), isto é só apresentação. Categoria nova (ex: de um plugin) cai no fallback (rótulo
// capitalizado, sem ícone) em vez de sumir da paleta.
const CATEGORY_ORDER = ["estrutura", "conteúdo"] as const;
const CATEGORY_PRESENTATION: Record<string, { label: string; icon: LucideIcon }> = {
  estrutura: { label: "Estrutura", icon: Layers },
  "conteúdo": { label: "Conteúdo", icon: Shapes },
};

// A lista já chega filtrada pela regra de posição do destino (raiz ou allowedBlockKeys da area) —
// este componente só agrupa por categoria e devolve a escolha.
export function BlockPaletteDialog({
  open,
  onOpenChange,
  definitions,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definitions: BlockDefinition[];
  onSelect: (definition: BlockDefinition) => void;
}) {
  const byCategory = new Map<string, BlockDefinition[]>();
  for (const definition of definitions) {
    const list = byCategory.get(definition.category) ?? [];
    list.push(definition);
    byCategory.set(definition.category, list);
  }
  const orderedCategories = Array.from(byCategory.entries()).sort(([left], [right]) => {
    const leftIndex = CATEGORY_ORDER.indexOf(left as (typeof CATEGORY_ORDER)[number]);
    const rightIndex = CATEGORY_ORDER.indexOf(right as (typeof CATEGORY_ORDER)[number]);
    if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar bloco</DialogTitle>
        </DialogHeader>

        {definitions.length === 0 && (
          <p className="text-sm text-muted-foreground/56">Nenhum bloco pode ser adicionado nesta posição.</p>
        )}

        <div className="max-h-96 space-y-4 overflow-y-auto">
          {orderedCategories.map(([category, items]) => {
            const presentation = CATEGORY_PRESENTATION[category];
            const CategoryIcon = presentation?.icon;
            return (
              <div key={category}>
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-caps text-muted-foreground/56">
                  {CategoryIcon && <CategoryIcon className="size-3.5" />}
                  {presentation?.label ?? category}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {items.map((definition) => (
                    <button
                      key={definition.key}
                      type="button"
                      onClick={() => {
                        onSelect(definition);
                        onOpenChange(false);
                      }}
                      className="rounded-lg border border-border p-2 text-left text-sm text-foreground outline-none ui-motion-base hover:border-ring hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {definition.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
