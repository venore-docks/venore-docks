"use client";

import { useActionState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import type { SourceView } from "@/contexts/content-feed";
import { deleteSourceAction, syncSourceAction, type ContentFeedActionState } from "../actions";

const initialState: ContentFeedActionState = { error: null };

export function SourcesList({ sources }: { sources: SourceView[] }) {
  return (
    <ul className="divide-y divide-border">
      {sources.map((source) => (
        <SourceRow key={source.id} source={source} />
      ))}
    </ul>
  );
}

function SourceRow({ source }: { source: SourceView }) {
  const [deleteState, deleteAction, deletePending] = useActionState(deleteSourceAction, initialState);
  const [syncState, syncAction, syncPending] = useActionState(syncSourceAction, initialState);
  useActionToast({ pending: deletePending, error: deleteState.error, successMessage: "Fonte removida." });
  useActionToast({ pending: syncPending, error: syncState.error, successMessage: syncState.error === null ? "Sincronizado." : null });

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium text-foreground">{source.name}</p>
        <p className="truncate text-xs text-muted-foreground">{source.remoteUrl}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{source.articleCount} artigo(s)</Badge>
          {source.categoryKeys.map((categoryKey) => (
            <Badge key={categoryKey} variant="outline">
              {categoryKey}
            </Badge>
          ))}
        </div>
        {source.lastSyncError ? (
          <p className="text-xs text-destructive">Última sincronização falhou: {source.lastSyncError}</p>
        ) : source.lastSyncedAt ? (
          <p className="text-xs text-muted-foreground">Sincronizado em {source.lastSyncedAt.toLocaleString("pt-BR")}</p>
        ) : (
          <p className="text-xs text-muted-foreground">Ainda não sincronizado.</p>
        )}
      </div>

      <div className="flex items-center gap-1">
        <form action={syncAction}>
          <input type="hidden" name="id" value={source.id} />
          <Button type="submit" variant="outline" size="sm" disabled={syncPending}>
            <RefreshCw className={syncPending ? "animate-spin" : undefined} /> Sincronizar agora
          </Button>
        </form>
        <form action={deleteAction}>
          <input type="hidden" name="id" value={source.id} />
          <Button type="submit" variant="ghost" size="icon-sm" disabled={deletePending}>
            <Trash2 className="text-destructive" />
          </Button>
        </form>
      </div>
    </li>
  );
}
