"use client";

// Mesmo padrão de admin/rbac/_components/category-scope-picker.tsx (lista por NOME, nunca id cru
// — memória feedback_admin_ux_no_dev_jargon), reimplementado localmente porque a fonte de opções é
// diferente (categorias do NOSSO cms, sem o wrapper de escopo do RBAC).
export function CategoryCheckboxPicker({
  categories,
  selected,
  onToggle,
  name = "categoryIds",
}: {
  categories: { id: string; name: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  name?: string;
}) {
  if (categories.length === 0) {
    return (
      <p className="rounded-panel border border-border bg-muted p-3 text-xs text-muted-foreground">
        Nenhuma categoria cadastrada ainda. Crie categorias em Editorial → Categorias antes de liberar uma conexão.
      </p>
    );
  }

  return (
    <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-panel border border-border p-2">
      {categories.map((category) => (
        <label key={category.id} className="flex items-center gap-2 rounded-md p-1.5 ui-motion-base hover:bg-muted">
          <input
            type="checkbox"
            name={name}
            value={category.id}
            checked={selected.includes(category.id)}
            onChange={() => onToggle(category.id)}
            className="rounded-sm outline-none ui-motion-base focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span className="text-sm text-foreground">{category.name}</span>
        </label>
      ))}
    </div>
  );
}
