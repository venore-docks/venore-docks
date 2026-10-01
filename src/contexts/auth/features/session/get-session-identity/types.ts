import type { OperationResult } from "@/shared/types";
import type { UserRegistrationStatus } from "../../../contracts/types";

export type SessionIdentity = { id: string; email: string | null; status: UserRegistrationStatus | null };

export type GetSessionIdentityResult = OperationResult<SessionIdentity | null>;
