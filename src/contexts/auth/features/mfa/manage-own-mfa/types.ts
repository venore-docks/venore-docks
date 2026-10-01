import type { OperationResult } from "@/shared/types";

export type MfaStatus = { enabled: boolean; enabledAt: Date | null; recoveryCodesLeft: number };
export type MfaEnrollment = { secret: string; otpauthUri: string };

export type GetOwnMfaStatusResult = OperationResult<MfaStatus>;
export type StartMfaEnrollmentInput = { issuer: string };
export type StartMfaEnrollmentResult = OperationResult<MfaEnrollment>;
export type ConfirmMfaEnrollmentInput = { code: string };
// Códigos de recuperação em claro: mostrados UMA vez, só o hash fica no banco.
export type ConfirmMfaEnrollmentResult = OperationResult<{ recoveryCodes: string[] }>;
export type DisableOwnMfaInput = { code: string };
export type DisableOwnMfaResult = OperationResult<{ disabled: true }>;
