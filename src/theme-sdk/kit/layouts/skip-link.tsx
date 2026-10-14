import type { ThemeStrings } from "@/contexts/themes/contracts/v8";
import { t } from "../i18n/t";

export const KIT_MAIN_CONTENT_ID = "conteudo";

// Link "pular para o conteúdo" (spec v8 §2.5 / §10): primeiro elemento focável da página, invisível
// até receber foco; aponta pro <main id="conteudo"> do ContentFrame. Fica no canto inicial
// (propriedades lógicas — espelha em RTL).
export function SkipLink({ strings }: { strings?: ThemeStrings }) {
  return (
    <a
      href={`#${KIT_MAIN_CONTENT_ID}`}
      className="sr-only rounded-lg bg-card px-4 py-2 text-sm font-medium text-foreground shadow-float outline-none focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-60 focus-visible:ring-2 focus-visible:ring-ring"
    >
      {t(strings, "skipLink.label")}
    </a>
  );
}
