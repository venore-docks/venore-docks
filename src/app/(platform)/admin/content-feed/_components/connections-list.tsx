"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import type { ContentFeedConnectionRecord } from "@/contexts/content-feed";
import { deleteConnectionAction, type ContentFeedActionState } from "../actions";
import { MaskedKey } from "./masked-key";

const initialState: ContentFeedActionState = { error: null };

export function ConnectionsList({
  connections,
  categoryNamesById,
}: {
  connections: ContentFeedConnectionRecord[];
  categoryNamesById: Map<string, string>;
}) {
  return (
    <ul className="divide-y divide-border">
      {connections.map((connection) => (
        <ConnectionRow key={connection.id} connection={connection} categoryNamesById={categoryNamesById} />
      ))}
    </ul>
  );
}

function ConnectionRow({
  connection,
  categoryNamesById,
}: {
  connection: ContentFeedConnectionRecord;
  categoryNamesById: Map<string, string>;
}) {
  const [state, formAction, pending] = useActionState(deleteConnectionAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Conexão removida." });

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium text-foreground">{connection.name}</p>
        <MaskedKey value={connection.key} />
        <div className="flex flex-wrap gap-1">
          {connection.categoryIds.length === 0 ? (
            <span className="text-xs text-muted-foreground">Nenhuma categoria liberada.</span>
          ) : (
            connection.categoryIds.map((categoryId) => (
              <Badge key={categoryId} variant="outline">
                {categoryNamesById.get(categoryId) ?? categoryId}
              </Badge>
            ))
          )}
        </div>
        {connection.lastUsedAt && (
          <p className="text-xs text-muted-foreground">Último acesso: {connection.lastUsedAt.toLocaleString("pt-BR")}</p>
        )}
      </div>

      <form action={formAction}>
        <input type="hidden" name="id" value={connection.id} />
        <Button type="submit" variant="ghost" size="icon-sm" disabled={pending}>
          <Trash2 className="text-destructive" />
        </Button>
      </form>
    </li>
  );
}
