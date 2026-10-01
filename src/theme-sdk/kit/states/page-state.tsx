import Link from "next/link";
import type { PageStateProps } from "@/contexts/themes/contracts/v8";

// Estado de página genérico do kit (mesma moldura de /unauthorized hoje). Dono: W4, que dá a
// cada estado (loading, empty, forbidden, maintenance, notFound) o desenho final.
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

export function KitLoadingState({ title }: PageStateProps) {
  return (
    <div role="status" aria-live="polite" className="py-12 text-center text-sm text-muted-foreground">
      {title}
    </div>
  );
}
