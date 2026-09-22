"use client";

import { useActionState, useState, useTransition } from "react";
import type { DragEvent } from "react";
import { Eye, EyeOff, FolderPlus, GripVertical, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useActionToast } from "@/hooks/use-action-toast";
import { NavIcon } from "@/platform/nav-icons/NavIcon";
import type { AdminMenuItemStatus, AdminResolvedMenuItem } from "@/contexts/cms";
import {
  moveMenuItemAction,
  removeMenuItemAction,
  toggleMenuItemVisibilityAction,
  type MenuActionState,
} from "../actions";
import { AddMenuItemDialog } from "./add-menu-item-dialog";
import { EditMenuItemDialog } from "./edit-menu-item-dialog";

const STATUS_LABELS: Record<AdminMenuItemStatus, string> = {
  active: "Ativo",
  hidden: "Oculto",
  "inactive-unpublished": "Não publicado",
  "pending-deleted": "Conteúdo apagado",
};

const STATUS_CLASSNAMES: Record<AdminMenuItemStatus, string> = {
  active: "border-border text-muted-foreground",
  hidden: "bg-muted text-muted-foreground",
  "inactive-unpublished": "bg-warning-soft text-warning",
  "pending-deleted": "bg-destructive/10 text-destructive",
};

type FlatNode = AdminResolvedMenuItem & { depth: number };

function flatten(nodes: AdminResolvedMenuItem[], depth = 0): FlatNode[] {
  return nodes.flatMap((node) => [{ ...node, depth }, ...flatten(node.children, depth + 1)]);
}

type DropZone = "before" | "into" | "after";

export function MenuTree({ menuId, items }: { menuId: string; items: AdminResolvedMenuItem[] }) {
  const flat = flatten(items);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; zone: DropZone } | null>(null);
  const [, startTransition] = useTransition();

  function isDescendant(node: FlatNode, candidateId: string): boolean {
    return node.children.some((child) => child.id === candidateId || isDescendant({ ...child, depth: 0 }, candidateId));
  }

  function handleDrop(target: FlatNode, zone: DropZone) {
    if (!draggingId || draggingId === target.id) return;

    const dragging = flat.find((node) => node.id === draggingId);
    if (dragging && isDescendant(dragging, target.id)) return; // proteção contra ciclo no client — servidor ainda revalida

    let parentId: string | null;
    let order: number;

    if (zone === "into") {
      parentId = target.id;
      order = target.children.length;
    } else if (zone === "before") {
      parentId = target.parentId;
      order = target.order;
    } else {
      parentId = target.parentId;
      order = target.order + 1;
    }

    startTransition(async () => {
      await moveMenuItemAction({ id: draggingId, parentId, order, menuId });
    });

    setDraggingId(null);
    setDropTarget(null);
  }

  if (flat.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Nenhum item neste menu ainda.
      </div>
    );
  }

  return (
    <ul className="space-y-1">
      {flat.map((node) => (
        <MenuTreeRow
          key={node.id}
          node={node}
          menuId={menuId}
          isDragging={draggingId === node.id}
          dropZone={dropTarget?.id === node.id ? dropTarget.zone : null}
          onDragStart={() => setDraggingId(node.id)}
          onDragEnd={() => {
            setDraggingId(null);
            setDropTarget(null);
          }}
          onDragOverZone={(zone) => setDropTarget({ id: node.id, zone })}
          onDrop={(zone) => handleDrop(node, zone)}
        />
      ))}
    </ul>
  );
}

function MenuTreeRow({
  node,
  menuId,
  isDragging,
  dropZone,
  onDragStart,
  onDragEnd,
  onDragOverZone,
  onDrop,
}: {
  node: FlatNode;
  menuId: string;
  isDragging: boolean;
  dropZone: DropZone | null;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOverZone: (zone: DropZone) => void;
  onDrop: (zone: DropZone) => void;
}) {
  const [visibilityState, visibilityAction, visibilityPending] = useActionState<MenuActionState, FormData>(
    toggleMenuItemVisibilityAction,
    { error: null },
  );
  const [removeState, removeAction, removePending] = useActionState<MenuActionState, FormData>(removeMenuItemAction, {
    error: null,
  });

  useActionToast({ pending: visibilityPending, error: visibilityState.error });
  useActionToast({ pending: removePending, error: removeState.error, successMessage: "Item removido." });

  function handleDragOver(event: DragEvent<HTMLLIElement>) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / rect.height;
    const zone: DropZone = ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "into";
    onDragOverZone(zone);
  }

  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={handleDragOver}
      onDrop={(event) => {
        event.preventDefault();
        if (dropZone) onDrop(dropZone);
      }}
      style={{ marginLeft: `${node.depth * 1.5}rem` }}
      className={cn(
        "relative flex items-center gap-2 rounded-md border border-border bg-card px-2 py-2",
        isDragging && "opacity-40",
        dropZone === "into" && "ring-2 ring-ring",
      )}
    >
      {dropZone === "before" && <div className="absolute inset-x-2 -top-1 h-0.5 rounded bg-ring" />}
      {dropZone === "after" && <div className="absolute inset-x-2 -bottom-1 h-0.5 rounded bg-ring" />}

      <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground/56" />
      <NavIcon iconKey={node.icon ?? undefined} className="size-4 shrink-0 text-muted-foreground/56" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{node.label}</span>
          <Badge variant="outline" className={STATUS_CLASSNAMES[node.status]}>
            {STATUS_LABELS[node.status]}
          </Badge>
          {node.targetType === "content" && node.contentTitle && node.contentTitle !== node.label && (
            <span className="text-xs text-muted-foreground/56">conteúdo: {node.contentTitle}</span>
          )}
          {(node.targetType === "external" || node.openInNewTab) && (
            <span className="text-xs text-muted-foreground/56">nova aba</span>
          )}
        </div>
        {node.reason && <p className="mt-0.5 text-xs text-muted-foreground">{node.reason}</p>}
        {!node.reason && node.resolvedHref && <p className="mt-0.5 text-xs text-muted-foreground/56">{node.resolvedHref}</p>}
      </div>

      <EditMenuItemDialog
        menuId={menuId}
        item={node}
        trigger={
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editar ${node.label}`}>
            <Pencil />
          </Button>
        }
      />

      <AddMenuItemDialog
        menuId={menuId}
        parentId={node.id}
        parentLabel={node.label}
        trigger={
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Adicionar item em ${node.label}`}>
            <FolderPlus />
          </Button>
        }
      />

      <form action={visibilityAction}>
        <input type="hidden" name="menuItemId" value={node.id} />
        <input type="hidden" name="menuId" value={menuId} />
        <input type="hidden" name="isVisible" value={(!node.isVisible).toString()} />
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          disabled={visibilityPending}
          aria-label={node.isVisible ? "Ocultar item" : "Exibir item"}
        >
          {node.isVisible ? <Eye /> : <EyeOff />}
        </Button>
      </form>

      <form action={removeAction}>
        <input type="hidden" name="menuItemId" value={node.id} />
        <input type="hidden" name="menuId" value={menuId} />
        <Button type="submit" variant="ghost" size="icon-sm" disabled={removePending} aria-label="Remover item">
          <Trash2 />
        </Button>
      </form>
    </li>
  );
}
