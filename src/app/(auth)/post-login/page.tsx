import { redirect } from "next/navigation";
import { getPostLoginDestination } from "@/platform/auth-flow/get-post-login-destination";

export default async function PostLoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  const destination = await getPostLoginDestination(callbackUrl ?? null);
  redirect(destination);
}
