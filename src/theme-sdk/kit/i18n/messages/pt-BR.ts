// Catálogo pt-BR do kit — texto IDÊNTICO ao que as regiões do venore-slime tinham fixo antes da
// v8 (spec §7.11). Dono: W8 (i18n/RTL), que acrescenta en/es/ar.
export const KIT_MESSAGES_PT_BR = {
  "header.signIn": "Entrar",
  "mobileNav.open": "Abrir navegação",
  "mobileNav.close": "Fechar navegação",
  "rail.expand": "Expandir barra lateral",
  "rail.collapse": "Colapsar barra lateral",
  "rail.enterAdmin": "Área administrativa",
  "rail.exitAdmin": "Sair do admin",
  "rail.site": "Site",
  "rail.admin": "Admin",
  "userMenu.admin": "Administração",
  "userMenu.account": "Minha conta",
  "userMenu.signOut": "Sair",
  "footer.signIn": "Entrar",
  "footer.credits": "Venore Docks",
  "breadcrumbs.label": "Breadcrumb",
  "contextual.label": "Navegação contextual",
  "skipLink.label": "Pular para o conteúdo",
  "error.title": "Algo deu errado",
  "error.message": "Não foi possível carregar esta página. Tente de novo em instantes.",
  "error.retry": "Tentar de novo",
  "notFound.title": "Página não encontrada",
  "notFound.message": "O endereço pode ter mudado ou o conteúdo não está mais disponível.",
  "notFound.home": "Voltar ao início",
  "loading.label": "Carregando…",
} as const satisfies Record<string, string>;
export type KitMessageKey = keyof typeof KIT_MESSAGES_PT_BR;
