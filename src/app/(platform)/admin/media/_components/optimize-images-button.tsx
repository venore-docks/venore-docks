"use client";

import { useState, useTransition } from "react";
import { ImageDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { backfillMediaVariantsAction } from "../actions";

// Gera as cópias redimensionadas (WebP 160–1920px) das imagens enviadas antes do sistema de
// variantes — upload novo já sai com elas. Roda em lotes (cada clique vira várias chamadas curtas,
// cabe no tempo de uma função serverless) até não sobrar nada ou um lote só falhar.
export function OptimizeImagesButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run() {
    setMessage(null);
    startTransition(async () => {
      let processed = 0;
      let generated = 0;
      let failed = 0;
      for (;;) {
        const result = await backfillMediaVariantsAction();
        if (!result.success) {
          setMessage(result.error.message);
          return;
        }
        processed += result.data.processed;
        generated += result.data.generated;
        failed += result.data.failed;
        setMessage(`Processando… ${processed} arquivo(s) verificados, ${result.data.remaining} restante(s).`);
        const onlyFailures = result.data.processed > 0 && result.data.failed === result.data.processed;
        if (result.data.remaining === 0 || result.data.processed === 0 || onlyFailures) {
          setMessage(
            `${processed} arquivo(s) verificados, ${generated} cópia(s) otimizada(s) criada(s)` +
              (failed > 0 ? `, ${failed} falha(s) — ${result.data.remaining} continuam pendentes.` : "."),
          );
          return;
        }
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="outline" size="sm" onClick={run} disabled={isPending} className="shrink-0">
        <ImageDown className="size-4" strokeWidth={2} />
        {isPending ? "Otimizando…" : "Otimizar imagens antigas"}
      </Button>
      {message && <p className="text-xs text-muted-foreground" aria-live="polite">{message}</p>}
    </div>
  );
}
