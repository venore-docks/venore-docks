import Link from "next/link";
import { Menu as MenuIcon } from "lucide-react";
import { listMenus } from "@/contexts/cms";
import type { MenuLocation } from "@/contexts/cms";
import { getCmsPageData } from "@/platform/admin-shell/get-cms-page-data";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { CreateMenuDialog } from "./_components/create-menu-dialog";
import { DeleteMenuButton } from "./_components/delete-menu-button";
import { EditMenuScopeDialog } from "./_components/edit-menu-scope-dialog";

const LOCATION_LABELS: Record<MenuLocation, string> = {
  main: "Principal",
  header: "Cabeçalho",
  contextual: "Contextual",
  sitemap: "Mapa do site",
};

export default async function MenusAdminPage() {
  const gate = await getCmsPageData();

  if (!gate.granted) {
    return (
      <div className="rounded-panel border border-border bg-card ui-panel-padding-roomy text-center">
        <h1 className="text-lg font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Você não tem permissão para gerenciar o conteúdo do site.</p>
      </div>
    );
  }

  const canManageMenus = gate.actor.isSuperadmin || gate.actor.permissions.includes("cms.menus.manage");
  if (!canManageMenus) {
    return (
      <div className="rounded-panel border border-border bg-card ui-panel-padding-roomy text-center">
        <h1 className="text-lg font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Você não tem permissão para gerenciar menus.</p>
      </div>
    );
  }

  const menusResult = await listMenus();
  if (!menusResult.success) {
    return <p className="text-sm text-destructive">Não foi possível carregar os menus agora. Tente recarregar a página.</p>;
  }

  const menus = menusResult.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Navegação</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Menus definem o que aparece na navegação do site — independente do que já existe publicado.
          </p>
        </div>
        <CreateMenuDialog />
      </div>

      <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
        {menus.length === 0 ? (
          <EmptyState
            icon={<MenuIcon className="size-8" strokeWidth={1.5} />}
            title="Nenhum menu criado ainda"
            description="Conteúdo publicado não aparece em lugar nenhum sozinho — crie um menu e adicione os itens que devem navegar até ele. Um menu pode existir vazio, antes de qualquer conteúdo."
            action={<CreateMenuDialog />}
          />
        ) : (
          <ul className="divide-y divide-border">
            {menus.map((menu) => (
              <li key={menu.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/cms/menus/${menu.id}`} className="text-sm font-medium text-foreground hover:underline">
                      {menu.name}
                    </Link>
                    <Badge variant="outline">{LOCATION_LABELS[menu.location]}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {menu.key}
                    {menu.scopePath && <> — escopo <code>{menu.scopePath}</code></>}
                    {" — "}
                    {menu.itemCount} {menu.itemCount === 1 ? "item" : "itens"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {menu.location === "contextual" && (
                    <EditMenuScopeDialog menuId={menu.id} menuName={menu.name} scopePath={menu.scopePath ?? ""} />
                  )}
                  <DeleteMenuButton menuId={menu.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
