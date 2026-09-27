import { getCurrentUserService } from "../../session/get-current-user/service";
import { confirmMfaEnrollment, disableOwnMfa, getOwnMfaStatus, startMfaEnrollment } from "./service";
import type {
  ConfirmMfaEnrollmentInput,
  ConfirmMfaEnrollmentResult,
  DisableOwnMfaInput,
  DisableOwnMfaResult,
  GetOwnMfaStatusResult,
  StartMfaEnrollmentInput,
  StartMfaEnrollmentResult,
} from "./types";

const UNAUTHENTICATED = { success: false as const, error: { code: "auth.unauthenticated", message: "É necessário estar autenticado." } };

// Autoatendimento: o ator é sempre a sessão atual.
async function currentUserId(): Promise<string | null> {
  const current = await getCurrentUserService();
  return current.success && current.data ? current.data.id : null;
}

export async function getOwnMfaStatusHandler(): Promise<GetOwnMfaStatusResult> {
  const userId = await currentUserId();
  return userId ? getOwnMfaStatus(userId) : UNAUTHENTICATED;
}

export async function startMfaEnrollmentHandler(input: StartMfaEnrollmentInput): Promise<StartMfaEnrollmentResult> {
  const userId = await currentUserId();
  return userId ? startMfaEnrollment(userId, input.issuer.trim().slice(0, 60) || "Venore") : UNAUTHENTICATED;
}

export async function confirmMfaEnrollmentHandler(input: ConfirmMfaEnrollmentInput): Promise<ConfirmMfaEnrollmentResult> {
  const userId = await currentUserId();
  return userId ? confirmMfaEnrollment(userId, input.code) : UNAUTHENTICATED;
}

export async function disableOwnMfaHandler(input: DisableOwnMfaInput): Promise<DisableOwnMfaResult> {
  const userId = await currentUserId();
  return userId ? disableOwnMfa(userId, input.code) : UNAUTHENTICATED;
}
