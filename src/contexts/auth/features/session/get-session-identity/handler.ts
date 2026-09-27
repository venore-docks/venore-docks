import { getSessionIdentityService } from "./service";
import type { GetSessionIdentityResult } from "./types";

export async function getSessionIdentityHandler(): Promise<GetSessionIdentityResult> {
  return getSessionIdentityService();
}
