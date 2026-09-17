"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ICON_BY_KEY } from "@/platform/nav-icons/registry";
import { NavIcon } from "@/platform/nav-icons/NavIcon";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Picker pesquisável — substitui o <Select> nativo/shadcn (rolagem longa pra achar um ícone) nos
// dois lugares que escolhem ícone: diálogos de item de menu (admin/cms/menus) e o campo tipo
// "icon" do editor de blocos (builder/_components/block-fields-panel.tsx). `options` vem de quem
// chama (mesma allowlist de platform/nav-icons/registry.ts, às vezes com um "Nenhum" ("") na
// frente) — o picker só filtra/renderiza, não decide o vocabulário de ícones disponível.
export function IconPicker({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const needle = search.trim().toLowerCase();
  const filtered = needle.length === 0 ? options : options.filter((option) => option.label.toLowerCase().includes(needle));
  const selected = options.find((option) => option.value === value);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm text-foreground outline-none ui-motion-base hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          {selected && selected.value ? <NavIcon iconKey={selected.value} className="size-4 shrink-0" /> : null}
          <span className="truncate">{selected ? selected.label : "Selecione"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar ícone..."
            className="h-8 pl-7 text-sm"
          />
        </div>
        <div className="mt-2 grid max-h-56 grid-cols-6 gap-1 overflow-y-auto">
          {filtered.map((option) => (
            <button
              key={option.value}
              type="button"
              title={option.label}
              aria-label={option.label}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                setSearch("");
              }}
              className={cn(
                "flex items-center justify-center rounded-md p-2 outline-none ui-motion-base hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                option.value === value && "bg-accent/14 text-primary",
              )}
            >
              {option.value && NAV_ICON_BY_KEY[option.value] ? (
                <NavIcon iconKey={option.value} className="size-4" />
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-6 py-4 text-center text-xs text-muted-foreground">Nenhum ícone encontrado.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
