"use client";

import { useState } from "react";
import { Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Chave em texto plano só é exibida sob pedido explícito do admin (mascarada por padrão) — mesmo
// padrão usado pra diagnosticsAgentKey no plugin broadcast.
export function MaskedKey({ value }: { value: string }) {
  const [revealed, setRevealed] = useState(false);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Chave copiada.");
    } catch {
      toast.error("Não foi possível copiar a chave.");
    }
  }

  return (
    <div className="flex items-center gap-1.5 font-mono text-xs">
      <span className="text-muted-foreground">{revealed ? value : "•".repeat(12)}</span>
      <Button type="button" variant="ghost" size="icon-xs" onClick={() => setRevealed((current) => !current)}>
        {revealed ? <EyeOff /> : <Eye />}
      </Button>
      <Button type="button" variant="ghost" size="icon-xs" onClick={copyToClipboard}>
        <Copy />
      </Button>
    </div>
  );
}
