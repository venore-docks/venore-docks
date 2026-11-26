import Link from "next/link";
import type { MediaUsageReference } from "@/platform/media-usage/types";

// Cada local mostrado com link direto pra tela onde o vínculo pode ser editado/removido (docs do
// pedido: "o detalhe do asset mostra onde ele é usado, com link para cada local").
export function UsageList({ usage }: { usage: MediaUsageReference[] }) {
  if (usage.length === 0) {
    return <p className="text-xs text-muted-foreground">Este arquivo não está em uso em nenhum lugar no momento.</p>;
  }

  return (
    <ul className="space-y-1">
      {usage.map((reference, index) => (
        <li key={`${reference.consumerKey}-${reference.href}-${index}`} className="flex items-center gap-2 text-xs">
          <span className="rounded-sm border border-border px-1.5 py-0.5 text-xs lg:text-[10px] font-medium text-muted-foreground">
            {reference.consumerLabel}
          </span>
          <Link href={reference.href} className="text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
            {reference.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
