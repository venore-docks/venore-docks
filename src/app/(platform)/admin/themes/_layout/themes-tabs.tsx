import Link from "next/link";
import { cn } from "@/lib/utils";

// Abas de /admin/themes (spec v8 §9). Cada aba é uma página própria com dono: Catálogo (F),
// Personalizar/Histórico/Transferir (W6), Galeria (W10).
export type ThemesTabKey = "catalog" | "customize" | "history" | "transfer" | "gallery";

const TABS: { key: ThemesTabKey; label: string; href: string }[] = [
  { key: "catalog", label: "Catálogo", href: "/admin/themes" },
  { key: "customize", label: "Personalizar", href: "/admin/themes/customize" },
  { key: "history", label: "Histórico", href: "/admin/themes/history" },
  { key: "transfer", label: "Transferir", href: "/admin/themes/transfer" },
  { key: "gallery", label: "Galeria", href: "/admin/themes/gallery" },
];

export function ThemesTabs({ current }: { current: ThemesTabKey }) {
  return (
    <nav aria-label="Seções de aparência" className="-mx-1 flex gap-1 overflow-x-auto border-b border-border pb-px">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === current ? "page" : undefined}
          className={cn(
            "shrink-0 rounded-t-lg px-3 py-2 text-sm text-muted-foreground ui-motion-base outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
            tab.key === current && "border-b-2 border-primary font-medium text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
