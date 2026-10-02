"use client";

import { ThemeErrorState } from "@/components/theme-error-state";

// Erro de página dentro da Shell (escada de erro, spec v8 §6). Dono: W4.
export default function PlatformError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset: () => void;
}) {
  return <ThemeErrorState error={error} reset={retry ?? reset} />;
}
