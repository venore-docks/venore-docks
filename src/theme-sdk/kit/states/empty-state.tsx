import type { ReactNode } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import type { PageStateProps } from "@/contexts/themes/contracts/v8";
import { cn } from "@/lib/utils";

// Estado vazio do kit (spec §7.9). `KitEmptyState` é o desenho (o mesmo de
// src/components/empty-state.tsx antes da v8, que agora reexporta este); `KitEmptyPageState` é o
// estado "empty" do tema (PageStateProps), com o ícone de livro que a home e a categoria usam.
export function KitEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-panel border border-dashed border-border bg-muted px-6 py-12 text-center",
        className,
      )}
    >
      {icon && <div className="text-muted-foreground/56">{icon}</div>}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function KitEmptyPageState({ title, message, action }: PageStateProps) {
  return (
    <KitEmptyState
      icon={<BookOpen className="size-8" strokeWidth={1.5} />}
      title={title}
      description={message ?? undefined}
      action={
        action ? (
          <Link href={action.href} className="text-sm text-primary underline">
            {action.label}
          </Link>
        ) : undefined
      }
    />
  );
}
