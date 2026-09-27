import { getSetting } from "@/contexts/settings";
import {
  isSelfRegistrationEnabled,
  REGISTRATION_APPROVAL_REQUIRED_SETTING_KEY,
} from "@/platform/registration/registration-settings";
import { getSettingsPageData } from "@/platform/admin-shell/get-settings-page-data";
import { RegistrationApprovalToggleForm } from "./_components/registration-approval-toggle-form";

export default async function SettingsAdminPage() {
  const gate = await getSettingsPageData();

  if (!gate.granted) {
    return (
      <div className="rounded-panel border border-border bg-card ui-panel-padding-roomy text-center">
        <h1 className="text-lg font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Você não tem permissão para gerenciar configurações do site.</p>
      </div>
    );
  }

  const settingResult = await getSetting({ key: REGISTRATION_APPROVAL_REQUIRED_SETTING_KEY });
  if (!settingResult.success) {
    return <p className="text-sm text-destructive">Não foi possível carregar as configurações agora. Tente recarregar a página.</p>;
  }

  // Mesmo fallback de handle-user-registered.ts: setting ausente ou com valor inesperado = aprovação exigida.
  const record = settingResult.data;
  const approvalRequired = !record || typeof record.value !== "boolean" ? true : record.value;
  const selfRegistration = await isSelfRegistrationEnabled();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configurações gerais do site.</p>
      </div>

      <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
        <h2 className="text-sm font-semibold text-foreground">Registro de usuários</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Defina se visitantes podem criar conta sozinhos e se novas contas precisam de aprovação de um admin. O
          primeiro superadmin é criado pelo instalador ou pela tela /setup (com SETUP_TOKEN).
        </p>
        <div className="mt-3">
          <RegistrationApprovalToggleForm enabled={approvalRequired} selfRegistration={selfRegistration} />
        </div>
      </section>
    </div>
  );
}
