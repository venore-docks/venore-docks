import { redirect } from "next/navigation";

// A antiga amostra de tokens (/admin/themes/preview?theme=&dark=1) virou a galeria viva (spec v8
// §7.13). Links e favoritos antigos continuam funcionando: os mesmos parâmetros, no formato novo.
// O gate (settings.manage) é o da galeria.
export default async function ThemePreviewRedirect({ searchParams }: { searchParams: Promise<{ theme?: string | string[]; dark?: string | string[] }> }) {
  const { theme, dark } = await searchParams;
  const params = new URLSearchParams();
  const key = Array.isArray(theme) ? theme[0] : theme;
  if (key) params.set("theme", key);
  if ((Array.isArray(dark) ? dark[0] : dark) === "1") params.set("mode", "dark");
  const query = params.toString();
  redirect(`/admin/themes/gallery${query ? `?${query}` : ""}`);
}
