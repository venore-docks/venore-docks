import { Badge } from "@/components/ui/badge";
import type { PaletteContrastView } from "@/platform/theme-engine/palette/palette-admin";

// Resumo do contraste por região da paleta ativa (spec v8 §7.14) na seção de paleta de
// /admin/themes. Só os problemas que a paleta introduz — a dívida do próprio tema fica no
// src/themes/a11y-baseline.json, não é decisão do admin.
export function PaletteContrastSummary({ problems }: { problems: readonly PaletteContrastView[] }) {
  if (problems.length === 0) {
    return (
      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">Contraste ok</Badge>
        Texto e controles da paleta ativa passam no mínimo de contraste em todas as regiões.
      </p>
    );
  }
  return (
    <div role="status" className="mt-4 rounded-lg border border-warning-border bg-warning-soft p-3 text-xs text-warning">
      <p className="font-medium">Contraste abaixo do mínimo com a paleta ativa:</p>
      <ul className="mt-1 list-disc space-y-1 ps-4">
        {problems.map((problem, index) => (
          <li key={index}>{problem.message}</li>
        ))}
      </ul>
    </div>
  );
}
