"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export type SpeechProgressValue = {
  total: number;
  ready: number;
  pending: number;
  processing: number;
  failed: number;
  currentPercent: number | null;
  lastError: string | null;
};

const REFRESH_MS = 15_000;
const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

// Produção do áudio de um conteúdo (contexts/speech): cada faixa é um texto (uma cena, um idioma);
// a barra mostra as faixas prontas e, pulsando, quanto da faixa em geração o worker já fez.
// Enquanto há fila, recarrega os dados da página a cada 15 s (router.refresh: só o RSC, sem perder
// o que está digitado num formulário).
export function SpeechProgress({
  progress,
  autoRefresh = true,
  compact = false,
}: {
  progress: SpeechProgressValue;
  autoRefresh?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const { total, ready, pending, processing, failed, currentPercent, lastError } = progress;
  const active = pending + processing > 0;

  useEffect(() => {
    if (!autoRefresh || !active) return;
    const timer = window.setInterval(() => router.refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [autoRefresh, active, router]);

  if (total === 0) return null;
  // A faixa em geração conta pela fração já feita (o worker informa a cada poucos segundos).
  const producedPercent = Math.min(100, Math.round(((ready + processing * ((currentPercent ?? 0) / 100)) / total) * 100));
  const readyPercent = percent(ready, total);
  const parts = [
    `${ready} de ${total} ${total === 1 ? "faixa pronta" : "faixas prontas"}`,
    processing > 0 ? `gerando ${processing === 1 ? "1 faixa" : `${processing} faixas`}${currentPercent ? ` (${currentPercent}%)` : ""}` : null,
    pending > 0 ? `${pending} na fila` : null,
    failed > 0 ? `${failed} com falha` : null,
  ].filter(Boolean);

  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      <div
        role="progressbar"
        aria-label="Áudio gerado"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={producedPercent}
        aria-valuetext={parts.join(", ")}
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full bg-primary ui-motion-base" style={{ width: `${readyPercent}%` }} />
        {processing > 0 && (
          <div className="h-full animate-pulse bg-primary/50" style={{ width: `${producedPercent - readyPercent}%`, minWidth: "4%" }} />
        )}
        {failed > 0 && <div className="h-full bg-destructive/60" style={{ width: `${percent(failed, total)}%` }} />}
      </div>
      <p className="text-xs text-muted-foreground">
        {producedPercent}% · {parts.join(" · ")}
        {active && !compact && " · atualiza sozinho"}
      </p>
      {failed > 0 && lastError && !compact && <p className="text-xs text-destructive">Último erro: {lastError}</p>}
    </div>
  );
}
