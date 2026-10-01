import { getCurrentUser, getCurrentUserRegistrationStatus } from "@/contexts/auth";
import { getUserContext, superadminExists } from "@/contexts/rbac";
import { toSafeCallbackUrl } from "./safe-callback-url";

export async function getPostLoginDestination(callbackUrl?: string | null): Promise<string> {
  // Status ANTES de getCurrentUser: getCurrentUser só reconhece contas "approved", então um
  // usuário OAuth recém-cadastrado (pending) caía em "/login" sem explicação — o ramo
  // /pending-approval era inalcançável.
  const statusResult = await getCurrentUserRegistrationStatus();
  if (statusResult.success && statusResult.data === "pending") {
    return "/pending-approval";
  }

  const currentUser = await getCurrentUser();
  if (!currentUser.success || !currentUser.data) {
    return "/login";
  }

  const existsResult = await superadminExists();
  if (!existsResult.success || !existsResult.data) {
    return "/setup";
  }

  // Deep link: volta pra página que pediu o login, se for um caminho relativo seguro.
  const safeCallback = toSafeCallbackUrl(callbackUrl);
  if (safeCallback) return safeCallback;

  const context = await getUserContext({ userId: currentUser.data.id });
  const hasAdminAccess =
    context.success && (context.data.isSuperadmin || context.data.permissions.includes("platform.admin.access"));

  return hasAdminAccess ? "/admin" : "/";
}
