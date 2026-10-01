import { redirect } from "next/navigation";
import { getSessionIdentity, listAvailableAuthProviders } from "@/contexts/auth";
import { superadminExists } from "@/contexts/rbac";
import { isSetupTokenConfigured } from "@/platform/registration/bootstrap-superadmin";
import { SetupForm } from "./setup-form";

export default async function SetupPage() {
  const existsResult = await superadminExists();
  if (existsResult.success && existsResult.data) {
    redirect("/post-login");
  }

  const identity = await getSessionIdentity();
  const sessionEmail = identity.success && identity.data ? identity.data.email : null;
  const passwordEnabled = listAvailableAuthProviders().some((provider) => provider.kind === "password" && provider.enabled);
  const tokenConfigured = isSetupTokenConfigured();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-foreground">
      <div className="w-full max-w-sm space-y-6 rounded-panel border border-border bg-card p-8 shadow-panel">
        <div className="space-y-1 text-center">
          <h1 className="text-lg font-semibold">Configuração inicial</h1>
          <p className="text-sm text-muted-foreground">Crie o primeiro superadmin deste site.</p>
        </div>

        {tokenConfigured ? (
          <SetupForm sessionEmail={sessionEmail} passwordEnabled={passwordEnabled} />
        ) : (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>A configuração pela web está desativada.</p>
            <p>
              Defina a variável de ambiente <code className="text-foreground">SETUP_TOKEN</code> (16 ou mais caracteres) e
              recarregue esta página, ou rode no servidor:
            </p>
            <pre className="overflow-x-auto rounded-control bg-muted px-3 py-2 text-xs text-foreground">npm run db:install:fresh</pre>
          </div>
        )}
      </div>
    </main>
  );
}
