"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import type { PermissionGroupView } from "./permission-catalog";

export function PermissionPicker({
  groups,
  name = "permissionKeys",
  selected,
  onToggle,
  searchInputId,
}: {
  groups: PermissionGroupView[];
  name?: string;
  selected: string[];
  onToggle: (key: string) => void;
  searchInputId?: string;
}) {
  const [search, setSearch] = useState("");

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groups;
    return groups
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter(
          (permission) =>
            permission.title.toLowerCase().includes(term) ||
            permission.description.toLowerCase().includes(term) ||
            permission.key.toLowerCase().includes(term),
        ),
      }))
      .filter((group) => group.permissions.length > 0);
  }, [groups, search]);

  return (
    <div className="overflow-hidden rounded-panel border border-border">
      <div className="sticky top-0 z-10 border-b border-border bg-card p-2">
        <Input
          id={searchInputId}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome da permissão..."
          className="h-8"
        />
      </div>
      <div className="max-h-80 space-y-4 overflow-y-auto p-3">
        {filteredGroups.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">Nenhuma permissão encontrada.</p>
        )}
        {filteredGroups.map((group) => (
          <div key={group.id}>
            <h5 className="text-xs font-semibold text-foreground">{group.label}</h5>
            <div className="mt-1.5 space-y-1">
              {group.permissions.map((permission) => (
                <label
                  key={permission.key}
                  className="flex items-start gap-2 rounded-md p-1.5 ui-motion-base hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    name={name}
                    value={permission.key}
                    checked={selected.includes(permission.key)}
                    onChange={() => onToggle(permission.key)}
                    className="mt-0.5 rounded-sm outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm text-foreground">{permission.title}</span>
                    <span className="text-xs text-muted-foreground">{permission.description}</span>
                    <span className="text-xs lg:text-[0.65rem] text-muted-foreground/56">{permission.key}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
