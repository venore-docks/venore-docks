import type { BreadcrumbSegmentDefinition } from "@/platform/breadcrumbs/types";
import { staticBreadcrumbSegment } from "@/platform/breadcrumbs/define-segment";

export const themesBreadcrumbSegments: BreadcrumbSegmentDefinition[] = [
  staticBreadcrumbSegment({ key: "themes.catalog", segments: ["admin", "themes"], label: "Temas" }),
  // Abas da v8 (spec §9).
  staticBreadcrumbSegment({ key: "themes.customize", segments: ["admin", "themes", "customize"], label: "Personalizar" }),
  staticBreadcrumbSegment({ key: "themes.history", segments: ["admin", "themes", "history"], label: "Histórico" }),
  staticBreadcrumbSegment({ key: "themes.transfer", segments: ["admin", "themes", "transfer"], label: "Transferir" }),
  staticBreadcrumbSegment({ key: "themes.gallery", segments: ["admin", "themes", "gallery"], label: "Galeria" }),
];
