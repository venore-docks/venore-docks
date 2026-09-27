import webpush from "web-push";
import { isAllowedPushEndpoint } from "../../shared/push-endpoint";
import { deleteById, listByActor } from "../../shared/store";
import type { SendPushResult, WebPushPayload } from "../../contracts/types";

// Configura o VAPID uma vez. Sem as chaves no ambiente, `enabled` fica false e sendPushToActor
// vira no-op (nunca derruba quem chama — push é acessório).
const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const CONTACT = process.env.WEB_PUSH_CONTACT ?? "mailto:admin@example.com";

let enabled = false;
if (PUBLIC_KEY && PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(CONTACT, PUBLIC_KEY, PRIVATE_KEY);
    enabled = true;
  } catch {
    enabled = false;
  }
}

export function isWebPushEnabled(): boolean {
  return enabled;
}

// Envia uma notificação para TODOS os devices inscritos de um usuário. Inscrições que o serviço
// de push rejeita como mortas (404/410) são apagadas. Best-effort — erro de envio nunca propaga.
export async function sendPushToActor(actorId: string, payload: WebPushPayload): Promise<SendPushResult> {
  if (!enabled) return { success: true, data: { sent: 0, pruned: 0 } };

  const subs = await listByActor(actorId);
  if (subs.length === 0) return { success: true, data: { sent: 0, pruned: 0 } };

  const body = JSON.stringify(payload);
  const dead: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (sub) => {
      // Inscrição gravada antes da allowlist (ou com host removido dela) nunca é chamada — e é
      // apagada como morta.
      if (!isAllowedPushEndpoint(sub.endpoint)) {
        dead.push(sub.id);
        return;
      }
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body);
        sent += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) dead.push(sub.id);
      }
    }),
  );

  await deleteById(dead);
  return { success: true, data: { sent, pruned: dead.length } };
}
