import { isAllowedPushEndpoint, isValidSubscriptionKey } from "../../shared/push-endpoint";
import { upsertSubscription } from "../../shared/store";
import type { SaveSubscriptionResult, WebPushSubscriptionInput } from "../../contracts/types";

export async function saveSubscription(
  actorId: string,
  input: WebPushSubscriptionInput,
): Promise<SaveSubscriptionResult> {
  if (!input.endpoint || !input.keys?.p256dh || !input.keys?.auth) {
    return { success: false, error: { code: "web-push.invalid_subscription", message: "Inscrição de push inválida." } };
  }
  if (!isValidSubscriptionKey(input.keys.p256dh) || !isValidSubscriptionKey(input.keys.auth)) {
    return { success: false, error: { code: "web-push.invalid_subscription", message: "Inscrição de push inválida." } };
  }
  if (!isAllowedPushEndpoint(input.endpoint)) {
    return {
      success: false,
      error: { code: "web-push.endpoint_not_allowed", message: "Serviço de push não reconhecido para este navegador." },
    };
  }

  const { id } = await upsertSubscription({
    actorId,
    endpoint: input.endpoint,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
    userAgent: input.userAgent?.slice(0, 400) ?? null,
  });

  return { success: true, data: { id } };
}
