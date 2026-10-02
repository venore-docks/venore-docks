import Link from "next/link";
import type { PageStateProps } from "@/contexts/themes/contracts/v8";
import { t } from "../i18n/t";

// Estado de página genérico do kit — a moldura de /unauthorized antes da v8, byte a byte. Usado
// por forbidden, notFound e maintenance (spec §7.9).
export function KitPageState({ title, message, action }: PageStateProps) {
  return (
    <div className="mx-auto max-w-md space-y-4 rounded-panel border border-border bg-card p-8 text-center shadow-panel">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {action && (
        <Link href={action.href} className="text-sm text-primary underline">
          {action.label}
        </Link>
      )}
    </div>
  );
}

// Manutenção: mesma moldura, anunciada como status (quem chega não vê o conteúdo, só o aviso).
export function KitMaintenanceState(props: PageStateProps) {
  return (
    <div role="status">
      <KitPageState {...props} />
    </div>
  );
}

// Só como fallback de <Suspense> dentro dos templates do kit (nunca loading.tsx no catch-all — um
// loading.tsx ali transformava 404 em 200, spec §15).
export function KitLoadingState({ title, strings }: Partial<PageStateProps> & Pick<PageStateProps, "strings">) {
  return (
    <div role="status" aria-live="polite" className="py-12 text-center text-sm text-muted-foreground">
      {title || t(strings, "loading.label")}
    </div>
  );
}
