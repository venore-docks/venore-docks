import { listCategories } from "@/contexts/cms";
import { listConnections, listSources } from "@/contexts/content-feed";
import { getContentFeedPageData } from "@/platform/admin-shell/get-content-feed-page-data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { Newspaper, Rss } from "lucide-react";
import { CreateConnectionForm } from "./_components/create-connection-form";
import { ConnectionsList } from "./_components/connections-list";
import { CreateSourceForm } from "./_components/create-source-form";
import { SourcesList } from "./_components/sources-list";

export default async function ContentFeedAdminPage() {
  const gate = await getContentFeedPageData();

  if (!gate.granted) {
    return (
      <div className="rounded-panel border border-border bg-card ui-panel-padding-roomy text-center">
        <h1 className="text-lg font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Você não tem permissão para acessar o feed de conteúdo.</p>
      </div>
    );
  }

  const canManageConnections = gate.actor.isSuperadmin || gate.actor.permissions.includes("content-feed.connections.manage");
  const canManageSources = gate.actor.isSuperadmin || gate.actor.permissions.includes("content-feed.sources.manage");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Feed de conteúdo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Publique conteúdo daqui pra outras instâncias venore-docks, ou traga o que outra instância publicou pra cá.
        </p>
      </div>

      <Tabs defaultValue={canManageConnections ? "publisher" : "subscriber"}>
        <TabsList>
          {canManageConnections && <TabsTrigger value="publisher">Quem pode assinar</TabsTrigger>}
          {canManageSources && <TabsTrigger value="subscriber">De onde eu assino</TabsTrigger>}
        </TabsList>

        {canManageConnections && (
          <TabsContent value="publisher">
            <PublisherSection />
          </TabsContent>
        )}

        {canManageSources && (
          <TabsContent value="subscriber">
            <SubscriberSection />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

async function PublisherSection() {
  const [connectionsResult, categoriesResult] = await Promise.all([listConnections(), listCategories()]);

  if (!connectionsResult.success) {
    return <p className="text-sm text-destructive">Não foi possível carregar as conexões agora. Tente recarregar a página.</p>;
  }

  const connections = connectionsResult.data;
  const categories = categoriesResult.success ? categoriesResult.data : [];
  const categoryOptions = categories.map((category) => ({ id: category.id, name: category.name }));
  const categoryNamesById = new Map(categories.map((category) => [category.id, category.name]));

  return (
    <section className="space-y-4 rounded-panel border border-border bg-card ui-panel-padding-roomy">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Cada conexão gera uma chave que outra instância apresenta pra buscar o conteúdo publicado aqui, só nas
          categorias liberadas.
        </p>
        {connections.length > 0 && <CreateConnectionForm categories={categoryOptions} />}
      </div>

      {connections.length === 0 ? (
        <EmptyState
          icon={<Rss className="size-8" strokeWidth={1.5} />}
          title="Nenhuma conexão ainda"
          description="Crie uma conexão pra liberar categorias de conteúdo pra outra instância."
          action={<CreateConnectionForm categories={categoryOptions} />}
        />
      ) : (
        <ConnectionsList connections={connections} categoryNamesById={categoryNamesById} />
      )}
    </section>
  );
}

async function SubscriberSection() {
  const sourcesResult = await listSources();

  if (!sourcesResult.success) {
    return <p className="text-sm text-destructive">Não foi possível carregar as fontes agora. Tente recarregar a página.</p>;
  }

  const sources = sourcesResult.data;

  return (
    <section className="space-y-4 rounded-panel border border-border bg-card ui-panel-padding-roomy">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Cadastre outra instância como fonte e sincronize manualmente pra trazer o conteúdo publicado por ela.
        </p>
        {sources.length > 0 && <CreateSourceForm />}
      </div>

      {sources.length === 0 ? (
        <EmptyState
          icon={<Newspaper className="size-8" strokeWidth={1.5} />}
          title="Nenhuma fonte ainda"
          description="Cadastre outra instância venore-docks como fonte de conteúdo."
          action={<CreateSourceForm />}
        />
      ) : (
        <SourcesList sources={sources} />
      )}
    </section>
  );
}
