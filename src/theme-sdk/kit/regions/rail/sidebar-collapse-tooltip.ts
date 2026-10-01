// Tooltip CSS-only pro rótulo escondido no estado colapsado da sidebar (docs/ui/shell-spec.md
// §3, requisito "colapsada: só ícones, com tooltip no hover e no foco"). Sem
// @radix-ui/react-tooltip — decisão desta sessão foi implementar a sidebar do zero em vez de
// adotar o primitivo `sidebar` do shadcn, então nada de puxar uma dependência nova só pro
// tooltip. O próprio rótulo (mesmo texto que já é o nome acessível do link/botão) vira o
// conteúdo flutuante: sem duplicar texto pra leitor de tela, sem JS.
//
// Compartilhado entre SidebarNavLink (item de nav) e o botão de alternância site/admin — os dois
// elementos interativos precisam da classe `group/sidebar-collapse-target` pra este seletor
// funcionar (Tailwind `group-[...]/<nome>:` lê o estado do ancestral com esse nome de grupo).
// max-w-[180px]: ver comentário em SidebarNavLink.tsx sobre de onde esse número vem (não é um
// valor solto — é o espaço que sobra dentro de --sidebar-width-expanded depois do padding do
// frame, do padding do item e do ícone+gap, pixel a pixel igual ao protótipo de referência).
export const SIDEBAR_COLLAPSE_TOOLTIP_LABEL_CLASSES =
  "overflow-hidden whitespace-nowrap max-w-[180px] translate-x-0 opacity-100 ui-motion-emphasis";

export const SIDEBAR_COLLAPSE_TOOLTIP_COLLAPSED_CLASSES =
  "lg:pointer-events-none lg:max-w-0 lg:-translate-x-2 lg:opacity-0 " +
  "lg:group-[:is(:hover,:focus-visible)]/sidebar-collapse-target:pointer-events-auto " +
  "lg:group-[:is(:hover,:focus-visible)]/sidebar-collapse-target:absolute " +
  "lg:group-[:is(:hover,:focus-visible)]/sidebar-collapse-target:top-1/2 " +
  "lg:group-[:is(:hover,:focus-visible)]/sidebar-collapse-target:left-full " +
  "lg:group-[:is(:hover,:focus-visible)]/sidebar-collapse-target:z-50 " +
  "lg:group-[:is(:hover,:focus-visible)]/sidebar-collapse-target:ml-2 " +
  "lg:group-[:is(:hover,:focus-visible)]/sidebar-collapse-target:max-w-none " +
  "lg:group-[:is(:hover,:focus-visible)]/sidebar-collapse-target:-translate-y-1/2 " +
  "lg:group-[:is(:hover,:focus-visible)]/sidebar-collapse-target:translate-x-0 " +
  "lg:group-[:is(:hover,:focus-visible)]/sidebar-collapse-target:rounded-lg " +
  "lg:group-[:is(:hover,:focus-visible)]/sidebar-collapse-target:border " +
  "lg:group-[:is(:hover,:focus-visible)]/sidebar-collapse-target:border-border " +
  "lg:group-[:is(:hover,:focus-visible)]/sidebar-collapse-target:bg-popover " +
  "lg:group-[:is(:hover,:focus-visible)]/sidebar-collapse-target:px-2 " +
  "lg:group-[:is(:hover,:focus-visible)]/sidebar-collapse-target:py-1 " +
  "lg:group-[:is(:hover,:focus-visible)]/sidebar-collapse-target:text-popover-foreground " +
  "lg:group-[:is(:hover,:focus-visible)]/sidebar-collapse-target:opacity-100 " +
  "lg:group-[:is(:hover,:focus-visible)]/sidebar-collapse-target:shadow-float";
