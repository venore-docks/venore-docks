import { readMaintenanceSetting } from "@/platform/theme-rendering/resolve-maintenance";
import { MaintenanceFormFields } from "./maintenance-form-fields";

// Modo manutenção (spec v8 §9/§7.9). A página de configurações já passou pelo gate
// (getSettingsPageData → settings.manage); a action autoriza de novo.
export async function MaintenanceForm() {
  const setting = await readMaintenanceSetting();
  return (
    <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
      <h2 className="text-sm font-semibold text-foreground">Modo manutenção</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ligado, visitantes e usuários sem acesso ao painel veem só um aviso no lugar do conteúdo (a página responde normalmente,
        marcada para não ser indexada). Quem tem acesso ao painel continua vendo o site, e o login segue disponível.
      </p>
      <div className="mt-3">
        <MaintenanceFormFields enabled={setting.enabled} message={setting.message} />
      </div>
    </section>
  );
}
