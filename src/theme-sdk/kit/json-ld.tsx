import { serializeJsonLd } from "@/shared/json-ld";

// JSON-LD sempre renderizado pelo CORE (spec §8 / §7.7): nunca por região/Shell de tema, pra que
// o escape de `</script>` (serializeJsonLd) valha independente do tema. Dono: W4.
export function CoreJsonLd({ data, nonce }: { data: Record<string, unknown> | null; nonce?: string }) {
  if (!data) return null;
  return <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
