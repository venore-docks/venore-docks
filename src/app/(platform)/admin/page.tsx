import { GraduationCap } from "lucide-react";
import { getAdminPageData } from "@/platform/admin-shell/get-admin-page-data";
import { getActivePluginKeys } from "@/platform/plugin-engine/get-active-plugin-keys";
import { PLUGIN_CONTRIBUTIONS } from "@/plugins/contributions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { signOutAction } from "@/app/(auth)/actions";

// force-dynamic herdado da árvore admin. O conteúdo do painel é contribuído pelos plugins ativos
// (contributions.adminDashboardPanel) — o core não conhece Academy nem nenhum outro plugin aqui;
// só o gate base (getAdminPageData) e a montagem. Primeiro painel não-nulo vence (hoje só a
// Academy contribui um).
export default async function AdminPage() {
  const gate = await getAdminPageData();

  if (!gate.granted) {
    return (
      <div className="rounded border border-border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Você não tem permissão para acessar a área administrativa.</p>
      </div>
    );
  }

  const activePluginKeys = await getActivePluginKeys();
  const panels = await Promise.all(
    Object.entries(PLUGIN_CONTRIBUTIONS)
      .filter(([key]) => activePluginKeys.has(key))
      .map(([, contributions]) => contributions.adminDashboardPanel?.() ?? null),
  );
  const panel = panels.find((value) => value != null) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Painel</h1>
          <p className="mt-1 text-sm text-muted-foreground">Visão geral da administração.</p>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="sm">
            Sair
          </Button>
        </form>
      </div>

      {panel ?? (
        <EmptyState
          icon={<GraduationCap className="size-8" strokeWidth={1.5} />}
          title="Nada para mostrar aqui"
          description="Escolha uma área no menu de administração para começar."
        />
      )}
    </div>
  );
}
