export type AuthenticatedUser = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  // Avatar escolhido via seletor de mídia — quando setado, tem prioridade sobre `image` (ver
  // consumidores de getCurrentUser, ex: resolve-theme-slot-props.ts).
  avatarMediaId: string | null;
};

// "approved" é o único estado "bom" — pending (aguardando aprovação), rejected (cadastro
// recusado), frozen (congelado por admin) e removed (conta removida/anonimizada) bloqueiam login
// igualmente (ver get-current-user/service.ts e providers.ts).
export type UserRegistrationStatus = "pending" | "approved" | "rejected" | "frozen" | "removed";

export type AuthProviderDescriptor = {
  key: "github" | "google" | "microsoft-entra-id" | "credentials" | "password";
  label: string;
  kind: "oauth" | "development" | "password";
  enabled: boolean;
  iconUrl?: string;
};
