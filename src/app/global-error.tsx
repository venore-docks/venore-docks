"use client";

import { KitErrorState } from "@/theme-sdk/kit/states/error-state";
import { KIT_STRINGS_PT_BR } from "@/theme-sdk/kit/i18n/t";
import "./globals.css";

// Falha do PRÓPRIO root layout (escada de erro, spec v8 §6): estático — sem banco, sem tema
// resolvido, sempre o venore-slime (fallback do sistema) e as strings pt-BR do kit.
export default function GlobalError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset: () => void;
}) {
  return (
    <html lang="pt-BR" data-theme="venore-slime">
      <body className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <KitErrorState error={error} reset={retry ?? reset} strings={KIT_STRINGS_PT_BR} />
      </body>
    </html>
  );
}
