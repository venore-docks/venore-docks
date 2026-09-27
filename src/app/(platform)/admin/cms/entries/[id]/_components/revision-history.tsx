"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import { applyEntryRevisionAction, discardEntryProposalAction, type EditEntryActionState } from "../actions";

export type RevisionHistoryItem = {
  id: string;
  kind: "snapshot" | "proposal";
  status: "pending" | "applied" | "discarded" | null;
  title: string;
  createdAt: string;
  authorLabel: string;
  isOwnProposal: boolean;
};

const initialState: EditEntryActionState = { error: null };

function RevisionActionButton({
  action,
  entryId,
  revisionId,
  label,
  variant = "outline",
}: {
  action: typeof applyEntryRevisionAction;
  entryId: string;
  revisionId: string;
  label: string;
  variant?: "outline" | "ghost" | "default";
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  useActionToast({ pending, error: state.error, successMessage: state.notice ?? null });
  return (
    <form action={formAction}>
      <input type="hidden" name="entryId" value={entryId} />
      <input type="hidden" name="revisionId" value={revisionId} />
      <Button type="submit" size="xs" variant={variant} disabled={pending}>
        {label}
      </Button>
    </form>
  );
}

const STATUS_LABEL: Record<string, string> = { pending: "Pendente", applied: "Aplicada", discarded: "Descartada" };

export function RevisionHistory({
  entryId,
  items,
  canPublish,
}: {
  entryId: string;
  items: RevisionHistoryItem[];
  canPublish: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma versão anterior ainda.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-0.5">
            <p className="flex items-center gap-2 text-sm text-foreground">
              <span className="truncate">{item.title}</span>
              {item.kind === "proposal" && (
                <Badge variant={item.status === "pending" ? "default" : "outline"}>
                  Proposta · {STATUS_LABEL[item.status ?? "pending"]}
                </Badge>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {item.kind === "proposal" ? "Proposta de" : "Versão salva antes de alteração por"} {item.authorLabel} ·{" "}
              {item.createdAt}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {item.kind === "proposal" && item.status === "pending" && (
              <>
                {canPublish && (
                  <RevisionActionButton action={applyEntryRevisionAction} entryId={entryId} revisionId={item.id} label="Aplicar" variant="default" />
                )}
                {(canPublish || item.isOwnProposal) && (
                  <RevisionActionButton action={discardEntryProposalAction} entryId={entryId} revisionId={item.id} label="Descartar" variant="ghost" />
                )}
              </>
            )}
            {item.kind === "snapshot" && (
              <RevisionActionButton action={applyEntryRevisionAction} entryId={entryId} revisionId={item.id} label="Restaurar" />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
