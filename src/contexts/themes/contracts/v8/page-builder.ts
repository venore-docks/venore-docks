import type { ComponentType } from "react";
import type { BlockRendererComponent, BlockRendererProps } from "@/platform/page-builder/block-renderers";

// Renderizadores de bloco do tema (spec §2.9 / §7.15): por chave de bloco e por variante de
// apresentação. `Default` é o renderer do core — o tema embrulha ou substitui.
export type ThemeBlockRendererProps = BlockRendererProps & { variant: string; Default: BlockRendererComponent };
export type ThemeBlockRenderers = Readonly<Record<string, Readonly<Record<string, ComponentType<ThemeBlockRendererProps>>>>>;
