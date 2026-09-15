import { PLUGIN_CONTRIBUTIONS } from "@/plugins/contributions";
import { beginOperation, endOperation } from "@/observability";
import { registerPlugins } from "../plugin-engine/register-plugins";
import type { NotificationAlert } from "./types";

// Badge no user-nav. Os providers vêm de src/plugins/*/contributions.ts (campo `notificationAlert`),
// agregados em PLUGIN_CONTRIBUTIONS pelo codegen — platform/ não importa um plugin diretamente
// (boundary). Só entra na consulta se o plugin estiver ativo agora: plugin desabilitado nunca
// deveria acender um alerta pra uma página que também está desabilitada. Primeiro alerta não-nulo
// vence — não soma contagens de plugins diferentes, cada um tem seu próprio destino (href).
//
// Um plugin marcado "active" no manifesto mas ainda sem as migrations aplicadas no banco (janela
// entre `npm install` da dependência e alguém clicar "Instalar" em /admin/plugins) não pode
// derrubar o shell inteiro pra todo mundo — isso bloquearia até a própria tela de instalação.
// Falha de um provider vira log e é ignorada, outros plugins continuam contribuindo normalmente.
export async function collectNotificationAlert(): Promise<NotificationAlert> {
  const pluginReport = await registerPlugins();
  const activePluginKeys = new Set(
    pluginReport.entries.filter((entry) => entry.status === "active").map((entry) => entry.key),
  );

  for (const [key, contributions] of Object.entries(PLUGIN_CONTRIBUTIONS)) {
    if (!activePluginKeys.has(key) || !contributions.notificationAlert) continue;
    const handle = beginOperation({
      useCase: "platform.notifications.collect-notification-alert",
      actor: { id: "system", type: "system" },
      kind: "read",
    });
    try {
      const alert = await contributions.notificationAlert();
      endOperation(handle, { success: true });
      if (alert) return alert;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      endOperation(handle, {
        success: false,
        error: { code: "platform.notifications.provider_failed", message: `Plugin "${key}": ${message}` },
      });
    }
  }

  return null;
}
