import type { Session } from "next-auth";
import type { AuthenticatedUser } from "../../../contracts/types";

export function toAuthenticatedUser(user: Session["user"], avatarMediaId: string | null): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
    image: user.image ?? null,
    avatarMediaId,
    authProvider: user.provider ?? null,
  };
}
