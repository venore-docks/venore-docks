import Link from "next/link";
import { redirect } from "next/navigation";
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

// Painel de "/" quando NÃO há entry "home" no CMS. Plataforma fechada: visitante sem sessão é
// redirecionado pro /login e aluno logado pro /academy antes daqui — então isto só é visto pelo
// admin. Nome do site + a vitrine que um plugin ativo contribuir (publicHomeShowcase, hoje a
// grade de cursos da Academy) + atalhos de admin. Primeira vitrine não-nula vence.
async function CoursesHome() {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{brand.siteName}</h1>
        <Button asChild size="sm" variant="outline">
          <Link href="/academy">
            Ver como aluno <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>

      {showcase ?? (
        <EmptyState
          icon={<BookOpen className="size-8" strokeWidth={1.5} />}
          title="Nenhum curso disponível ainda"
          description="Os cursos aparecem aqui assim que forem publicados."
        />
      )}

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
    </div>
  );
}

export default async function HomePage() {
  const currentUser = await getCurrentUser();
  const isAuthenticated = currentUser.success && Boolean(currentUser.data);

  // Plataforma fechada: visitante sem sessão sempre cai no login (pedido do dono, "aluno não
  // logado deve cair em /login SEMPRE"). Não há landing pública.
  if (!isAuthenticated) {
    redirect("/login");
  }

  const adminGate = await getAdminPageData();

  // Aluno logado (sem acesso ao admin) vai direto pro dashboard dele.
  if (!adminGate.granted) {
    redirect("/academy");
  }

  // Daqui pra baixo só admin: mostra a entry "home" do CMS se existir, senão o painel de cursos.
  const result = await getPublishedEntryBySlug({ categoryId: null, slug: HOME_SLUG });
  const entry = result.success && result.data ? result.data : null;

  if (entry) {
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

  return <CoursesHome />;
}
