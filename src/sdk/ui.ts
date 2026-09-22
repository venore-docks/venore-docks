// @venore/plugin-sdk/ui — superfície CLIENT (React) que um plugin pode usar: primitivos shadcn,
// componentes compartilhados do core, hooks e utilitários de UI. Ver src/sdk/index.ts pro
// racional e o plano em docs/plugins-repos-separados-plano.md.

// --- primitivos shadcn (src/components/ui/*) ---
export * from "@/components/ui/button";
export * from "@/components/ui/input";
export * from "@/components/ui/badge";
export * from "@/components/ui/textarea";
export * from "@/components/ui/dialog";
export * from "@/components/ui/select";
export * from "@/components/ui/card";
export * from "@/components/ui/progress";
export * from "@/components/ui/tabs";
export * from "@/components/ui/table";
export * from "@/components/ui/chart";
export * from "@/components/ui/alert-dialog";
export * from "@/components/ui/switch";
export * from "@/components/ui/dropdown-menu";
export * from "@/components/ui/slider";
export * from "@/components/ui/popover";

// --- componentes compartilhados do core ---
export * from "@/components/empty-state";
export * from "@/components/admin-access-denied";
export * from "@/components/admin-page-header";
export * from "@/components/admin-stat-tile";
export * from "@/components/media-picker-field";
export * from "@/components/media-picker-field.actions";
export * from "@/components/pwa/push-toggle";

// --- hooks / utils ---
export * from "@/hooks/use-action-toast";
export { cn } from "@/lib/utils";

// --- page-builder (client) ---
// NÃO reexportar aqui @/platform/page-builder/block-renderers nem @/components/page-builder/
// block-renderer — os dois são "server-only" e envenenariam TODO bundle client que importa deste
// entrypoint (`export *` arrasta o grafo inteiro). Os TIPOS de renderer (BlockRendererComponent/
// Props/Mode) e o componente <BlockRenderer> vêm de "@venore/plugin-sdk" (entry server).
export * from "@/platform/page-builder/block-field-panels";
export type { PluginClientContributions } from "@/platform/page-builder/plugin-client-contributions";
