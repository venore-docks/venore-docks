"use client";

import { ThemeErrorState } from "@/components/theme-error-state";

// Erro lançado pelo (platform)/layout, por layout ou região de tema (escada de erro, spec v8 §6):
// renderiza sem a Shell, dentro do root layout. Dono: W4.
export default function RootError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <ThemeErrorState error={error} reset={retry ?? reset} />
    </main>
  );
}
