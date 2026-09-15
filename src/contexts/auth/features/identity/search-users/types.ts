import type { OperationResult } from "@/shared/types";
import type { UserRegistrationStatus } from "../../../contracts/types";

export type SearchUsersQuery = {
  // Lookup direto por id — usado pela página de perfil (/admin/community/[userId]), que precisa de
  // UM usuário, não de uma página. Mesma feature, sem criar uma segunda pra um WHERE a mais.
  id?: string;
  search?: string;
  status?: UserRegistrationStatus;
  limit?: number;
  cursor?: string;
};

export type UserSummary = {
  id: string;
  name: string | null;
  email: string;
  status: UserRegistrationStatus;
  createdAt: Date;
  lastLoginAt: Date | null;
};

export type SearchUsersResult = OperationResult<{ entries: UserSummary[]; hasMore: boolean }>;
