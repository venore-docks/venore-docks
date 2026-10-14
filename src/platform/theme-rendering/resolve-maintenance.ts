import { cache } from "react";
import { CORE_SETTING_DEFAULTS, getSetting } from "@/contexts/settings";

// Modo manutenção (setting platform.maintenance, spec §4.1/§7.9). Quem tem acesso ao admin
// (gate do layout) continua vendo o site; o resto vê o estado "maintenance" do tema no lugar do
// conteúdo, com status 200 e robots noindex (metadata-defaults). /login fica no grupo (auth),
// fora do (platform)/layout — um admin sempre consegue entrar para desligar.
export const MAINTENANCE_SETTING_KEY = "platform.maintenance";
export const MAINTENANCE_MESSAGE_MAX_LENGTH = 500;

export type MaintenanceSetting = { enabled: boolean; message: string };

// Valor salvo com forma inesperada conta como desligado — manutenção nunca liga "por engano".
export function parseMaintenanceSetting(value: unknown): MaintenanceSetting {
  const fallback = CORE_SETTING_DEFAULTS[MAINTENANCE_SETTING_KEY];
  if (!value || typeof value !== "object") return { ...fallback };
  const record = value as { enabled?: unknown; message?: unknown };
  return {
    enabled: record.enabled === true,
    message: typeof record.message === "string" ? record.message.slice(0, MAINTENANCE_MESSAGE_MAX_LENGTH) : "",
  };
}

// Uma leitura por request (layout, metadata e o estado leem o mesmo valor). Erro de leitura =
// desligado: falhar fechado aqui esconderia o site inteiro por um soluço do banco.
export const readMaintenanceSetting = cache(async (): Promise<MaintenanceSetting> => {
  const result = await getSetting({ key: MAINTENANCE_SETTING_KEY });
  if (!result.success || !result.data) return { ...CORE_SETTING_DEFAULTS[MAINTENANCE_SETTING_KEY] };
  return parseMaintenanceSetting(result.data.value);
});

export async function resolveMaintenance(gate: { granted: boolean }): Promise<boolean> {
  if (gate.granted) return false;
  return (await readMaintenanceSetting()).enabled;
}
