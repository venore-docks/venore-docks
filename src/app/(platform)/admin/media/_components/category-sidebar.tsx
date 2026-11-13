import Link from "next/link";
import { FolderOpen, Inbox, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { libraryHref, type LibraryParams } from "../_lib/media-library";
import { ManageCategories } from "./manage-categories";

type SidebarCategory = { id: string; name: string };

function SidebarLink({
  href,
  active,
  icon,
  label,
  count,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring lg:w-full",
        active
          ? "border-primary/30 bg-primary/10 font-medium text-foreground"
          : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span className={cn("shrink-0", active ? "text-primary" : "text-muted-foreground/56")}>{icon}</span>
      <span className="truncate">{label}</span>
      <span className={cn("ms-auto ps-2 text-xs tabular-nums", active ? "text-foreground" : "text-muted-foreground/56")}>{count}</span>
    </Link>
  );
}

// Navegação por categoria: no mobile vira uma faixa horizontal rolável de "pílulas", a partir de lg
// uma coluna fixa ao lado da biblioteca. Cada item mostra quantos arquivos tem.
export function CategorySidebar({
  categories,
  params,
  total,
  uncategorized,
  countByCategory,
}: {
  categories: SidebarCategory[];
  params: LibraryParams;
  total: number;
  uncategorized: number;
  countByCategory: Record<string, number>;
}) {
  const active = params.category ?? "";
  const hrefFor = (category: string | undefined) => libraryHref(params, { category, page: undefined });

  return (
    <aside aria-label="Categorias" className="min-w-0 lg:w-60 lg:shrink-0">
      <div className="rounded-panel border border-border bg-card p-2 lg:sticky lg:top-4">
        <p className="hidden px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/56 lg:block">
          Biblioteca
        </p>
        <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          <SidebarLink href={hrefFor(undefined)} active={active === ""} icon={<Layers className="size-4" />} label="Todos os arquivos" count={total} />
          <SidebarLink
            href={hrefFor("none")}
            active={active === "none"}
            icon={<Inbox className="size-4" />}
            label="Sem categoria"
            count={uncategorized}
          />
          {categories.length > 0 && (
            <p className="hidden px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground/56 lg:block">
              Categorias
            </p>
          )}
          {categories.map((category) => (
            <SidebarLink
              key={category.id}
              href={hrefFor(category.id)}
              active={active === category.id}
              icon={<FolderOpen className="size-4" />}
              label={category.name}
              count={countByCategory[category.id] ?? 0}
            />
          ))}
        </nav>
        <div className="mt-1 border-t border-border pt-2">
          <ManageCategories categories={categories} countByCategory={countByCategory} />
        </div>
      </div>
    </aside>
  );
}
