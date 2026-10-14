"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { discardPreviewDraftAction, exitThemePreviewAction, publishPreviewDraftAction } from "./preview-actions";

export type PreviewBannerKind = "draft" | "gallery" | "safe-mode";

const LABELS: Record<PreviewBannerKind, string> = {
  draft: "Você está vendo o rascunho da aparência — só você, enquanto durar a pré-visualização.",
  gallery: "Você está vendo um tema da galeria — só você.",
  "safe-mode": "Modo seguro: o tema padrão (Venore Slime) está ativo só para você.",
};

const subscribeNoop = () => () => undefined;
// Dentro do iframe do /admin/themes/customize a faixa some: o próprio painel já tem as ações.
const isInsideFrame = () => window.self !== window.top;

export function PreviewBannerBar({ kind }: { kind: PreviewBannerKind }) {
  const router = useRouter();
  const framed = useSyncExternalStore(subscribeNoop, isInsideFrame, () => false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (framed) return null;

  const run = (action: () => Promise<{ error: string | null }>) =>
    startTransition(async () => {
      const result = await action();
      setError(result.error);
      if (!result.error) router.refresh();
    });

  return (
    <div
      role="region"
      aria-label="Pré-visualização de aparência"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-popover text-popover-foreground shadow-lg"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>
          {LABELS[kind]}
          {error && <span className="ms-2 text-destructive">{error}</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {kind === "draft" && (
            <>
              <Button size="sm" disabled={pending} onClick={() => run(publishPreviewDraftAction)}>
                Publicar
              </Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(discardPreviewDraftAction)}>
                Descartar rascunho
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(exitThemePreviewAction)}>
            {kind === "safe-mode" ? "Sair do modo seguro" : "Sair da pré-visualização"}
          </Button>
        </div>
      </div>
    </div>
  );
}
