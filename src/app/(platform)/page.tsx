import Link from "next/link";
import { ArrowRight, BookOpen, Settings2 } from "lucide-react";
import { getEntryBody, getEntryComposition, getPublishedEntryBySlug, recordEntryView } from "@/contexts/cms";
import { getCurrentUser } from "@/contexts/auth";
import { getAdminPageData } from "@/platform/admin-shell/get-admin-page-data";
import { getActivePluginKeys } from "@/platform/plugin-engine/get-active-plugin-keys";
import { getBrandConfig } from "@/platform/brand/get-brand-config";
import { PLUGIN_CONTRIBUTIONS } from "@/plugins/contributions";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { BlockRenderer } from "@/components/page-builder/block-renderer";

// force-dynamic: conteúdo (CMS) e tema ativo são runtime-configuráveis, sem rebuild
// (docs/venore-docks.md — "Sobre temas").
export const dynamic = "force-dynamic";

// Home é a entry reservada com categoryId null e slug "home".
const HOME_SLUG = "home";

// Painel de "/" quando NÃO há entry "home" no CMS. Plataforma aberta (pedido do dono, "site tem
// que ficar aberto, só o admin precisa de login"): visitante sem sessão vê isto igual a qualquer
// outro visitante — só os atalhos de admin abaixo ficam escondidos de quem não tem acesso ao
// painel. Nome do site + a vitrine que um plugin ativo contribuir (publicHomeShowcase) + atalhos
// de admin quando aplicável. Primeira vitrine não-nula vence.
async function CoursesHome({ canAccessAdmin }: { canAccessAdmin: boolean }) {
  const activePluginKeys = await getActivePluginKeys();
  const [brand, showcases] = await Promise.all([
    getBrandConfig(),
    Promise.all(
      Object.entries(PLUGIN_CONTRIBUTIONS)
        .filter(([key]) => activePluginKeys.has(key))
        .map(([, contributions]) => contributions.publicHomeShowcase?.() ?? null),
    ),
  ]);
  const showcase = showcases.find((value) => value != null) ?? null;
  // "Ver como aluno" só faz sentido em instâncias com a Academy ativa — numa instância sem o
  // plugin, /academy nem existe (resolvePublicPluginRoute devolveria notFound).
  const hasAcademy = activePluginKeys.has("academy");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{brand.siteName}</h1>
        {hasAcademy && (
          <Button asChild size="sm" variant="outline">
            <Link href="/academy">
              Ver como aluno <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        )}
      </div>

      {showcase ?? (
        <EmptyState
          icon={<BookOpen className="size-8" strokeWidth={1.5} />}
          title="Nenhum conteúdo publicado ainda"
          description="O conteúdo aparece aqui assim que for publicado."
        />
      )}

      {canAccessAdmin && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin" className="text-muted-foreground/56">
              <Settings2 className="size-4" strokeWidth={1.5} /> Painel
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/cms/entries/new" className="text-muted-foreground/56">
              Personalizar a home no CMS
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export default async function HomePage() {
  const currentUser = await getCurrentUser();
  const isAuthenticated = currentUser.success && Boolean(currentUser.data);
  const adminGate = await getAdminPageData();

  // Plataforma aberta (pedido do dono, "site tem que ficar aberto, só o admin precisa de login"):
  // qualquer visitante — com ou sem sessão — vê a entry "home" do CMS quando ela existir e for
  // visível pra ele. "authenticated" (C7, mesma regra do catch-all em [...slug]/page.tsx) só
  // aparece pra quem tem sessão; sem entry ou sem visibilidade, cai no painel abaixo. O gate de
  // admin em si não muda aqui — continua em getAdminPageData(), checado de novo em cada página
  // administrativa.
  const result = await getPublishedEntryBySlug({ categoryId: null, slug: HOME_SLUG });
  const entry = result.success && result.data ? result.data : null;
  const canViewEntry = entry != null && (entry.visibility === "public" || isAuthenticated);

  if (entry && canViewEntry) {
    recordEntryView(entry.id);
    const compositionResult = await getEntryComposition({ id: entry.id });
    const composition = compositionResult.success ? compositionResult.data : null;

    return composition ? (
      <BlockRenderer blocks={composition} mode="published" />
    ) : (
      <article>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{entry.title}</h1>
        <p className="mt-2 text-muted-foreground">{getEntryBody(entry.data)}</p>
      </article>
    );
  }

  return <CoursesHome canAccessAdmin={adminGate.granted} />;
}
