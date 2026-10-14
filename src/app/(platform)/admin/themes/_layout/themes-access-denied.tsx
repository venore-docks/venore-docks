// Mesmo bloco de "Acesso negado" que /admin/themes já mostrava, compartilhado pelas abas.
export function ThemesAccessDenied() {
  return (
    <div className="rounded-panel border border-border bg-card ui-panel-padding-roomy text-center">
      <h1 className="text-lg font-semibold text-foreground">Acesso negado</h1>
      <p className="mt-2 text-sm text-muted-foreground">Você não tem permissão para gerenciar temas.</p>
    </div>
  );
}

// Aba ainda sem conteúdo (stub da Fase F — o dono troca pela página de verdade).
export function ThemesTabPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </section>
  );
}
