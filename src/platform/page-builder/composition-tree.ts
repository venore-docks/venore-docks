import type { Area, Block, BlockDefinition, Composition } from "@/contexts/cms";

// Módulo puro (sem React, sem DOM) — as operações da árvore de composição precisam sobreviver
// intactas quando a UI de edição trocar de árvore-com-botões (esta sessão) pra drag-and-drop
// (PB4). Toda função aqui devolve uma nova árvore; nunca muta `composition` nem seus blocos.

// id estável na criação (crypto.randomUUID), nunca derivado de índice — se o id mudasse ao
// reordenar, as keys do React (e o DnD futuro) quebrariam de formas difíceis de depurar.
export function createBlock(definition: BlockDefinition): Block {
  return {
    id: crypto.randomUUID(),
    key: definition.key,
    slot: "",
    htmlId: null,
    data: { ...definition.defaultData },
    areas: definition.structure === "areas" ? (definition.areaDefinitions ?? []).map((area) => ({ key: area.key, blocks: [] })) : [],
  };
}

export function findBlock(blocks: Composition, targetId: string): Block | null {
  for (const block of blocks) {
    if (block.id === targetId) {
      return block;
    }
    for (const area of block.areas) {
      const found = findBlock(area.blocks, targetId);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

// Regra de posição de quem pode ficar ao lado de um bloco: raiz (allowedInRoot) ou a
// allowedBlockKeys da area que o contém. Usada pra filtrar a paleta ao adicionar um irmão.
export type PositionContext = { isRoot: true } | { isRoot: false; areaKey: string; allowedBlockKeys: string[] };

export function getPositionContext(
  composition: Composition,
  blockId: string,
  resolveDefinition: (key: string) => BlockDefinition | null,
): PositionContext | null {
  if (composition.some((block) => block.id === blockId)) {
    return { isRoot: true };
  }

  for (const block of composition) {
    for (const area of block.areas) {
      if (area.blocks.some((child) => child.id === blockId)) {
        const definition = resolveDefinition(block.key);
        const areaDefinition = definition?.areaDefinitions?.find((candidate) => candidate.key === area.key);
        return { isRoot: false, areaKey: area.key, allowedBlockKeys: areaDefinition?.allowedBlockKeys ?? [] };
      }
      const nested = getPositionContext(area.blocks, blockId, resolveDefinition);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

// Aplica `fn` na primeira lista de blocos (raiz ou area) que contém `targetId`; devolve a árvore
// inteira reconstruída (sem mutar o original). `fn` recebe a lista e devolve a lista já com a
// operação aplicada, ou null se essa lista não é a procurada (aí a função recursa nas areas).
function mapListContaining(blocks: Composition, targetId: string, fn: (list: Block[]) => Block[]): Composition {
  if (blocks.some((block) => block.id === targetId)) {
    return fn(blocks);
  }

  return blocks.map((block) => {
    if (block.areas.length === 0) {
      return block;
    }
    return {
      ...block,
      areas: block.areas.map((area): Area => ({ key: area.key, blocks: mapListContaining(area.blocks, targetId, fn) })),
    };
  });
}

function mapBlockById(blocks: Composition, targetId: string, fn: (block: Block) => Block): Composition {
  return blocks.map((block) => {
    if (block.id === targetId) {
      return fn(block);
    }
    if (block.areas.length === 0) {
      return block;
    }
    return {
      ...block,
      areas: block.areas.map((area): Area => ({ key: area.key, blocks: mapBlockById(area.blocks, targetId, fn) })),
    };
  });
}

export function insertSibling(
  composition: Composition,
  siblingId: string,
  newBlock: Block,
  position: "before" | "after",
): Composition {
  return mapListContaining(composition, siblingId, (list) => {
    const index = list.findIndex((block) => block.id === siblingId);
    const insertAt = position === "before" ? index : index + 1;
    return [...list.slice(0, insertAt), newBlock, ...list.slice(insertAt)];
  });
}

export function appendToRoot(composition: Composition, newBlock: Block): Composition {
  return [...composition, newBlock];
}

export function addChild(composition: Composition, parentId: string, areaKey: string, newBlock: Block): Composition {
  return mapBlockById(composition, parentId, (block) => ({
    ...block,
    areas: block.areas.map((area) => (area.key === areaKey ? { ...area, blocks: [...area.blocks, newBlock] } : area)),
  }));
}

export function removeBlock(composition: Composition, blockId: string): Composition {
  if (!findBlock(composition, blockId)) {
    return composition;
  }
  return mapListContaining(composition, blockId, (list) => list.filter((block) => block.id !== blockId));
}

export function moveBlock(composition: Composition, blockId: string, direction: "up" | "down"): Composition {
  return mapListContaining(composition, blockId, (list) => {
    const index = list.findIndex((block) => block.id === blockId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) {
      return list;
    }
    const next = [...list];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    return next;
  });
}

function cloneWithNewIds(block: Block): Block {
  return {
    ...block,
    id: crypto.randomUUID(),
    // Duplicar um bloco não pode duplicar o id de âncora junto — dois elementos com o mesmo `id`
    // no DOM quebrariam qualquer link que aponte pra ele.
    htmlId: null,
    areas: block.areas.map((area) => ({ key: area.key, blocks: area.blocks.map(cloneWithNewIds) })),
  };
}

export function duplicateBlock(composition: Composition, blockId: string): Composition {
  const original = findBlock(composition, blockId);
  if (!original) {
    return composition;
  }
  return insertSibling(composition, blockId, cloneWithNewIds(original), "after");
}

export function updateBlockData(composition: Composition, blockId: string, data: Record<string, unknown>): Composition {
  return mapBlockById(composition, blockId, (block) => ({ ...block, data }));
}

// htmlId vive no bloco, não em `data` — precisa do próprio setter, espelhando updateBlockData.
export function updateBlockHtmlId(composition: Composition, blockId: string, htmlId: string | null): Composition {
  return mapBlockById(composition, blockId, (block) => ({ ...block, htmlId }));
}

// Traduz o `path` de ValidateCompositionError (ex: "$[0].areas[0][1]") de volta pro id do bloco
// culpado, pra destacar o bloco certo no editor em vez de um toast genérico.
export function resolveErrorBlockId(composition: Composition, path: string): string | null {
  const tokens = path.match(/\.areas\[\d+\]|\[\d+\]/g) ?? [];
  let list: Composition = composition;
  let current: Block | null = null;

  for (const token of tokens) {
    if (token.startsWith(".areas")) {
      const areaIndex = Number(token.replace(/\D/g, ""));
      const area = current?.areas[areaIndex];
      if (!area) {
        return current?.id ?? null;
      }
      list = area.blocks;
    } else {
      const index = Number(token.replace(/\D/g, ""));
      const block = list[index];
      if (!block) {
        return current?.id ?? null;
      }
      current = block;
    }
  }

  return current?.id ?? null;
}
