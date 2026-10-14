import type { BreadcrumbSegmentDefinition } from "@/platform/breadcrumbs/types";
import { staticBreadcrumbSegment } from "@/platform/breadcrumbs/define-segment";

export const speechBreadcrumbSegments: BreadcrumbSegmentDefinition[] = [
  staticBreadcrumbSegment({ key: "speech.overview", segments: ["admin", "speech"], label: "Áudios" }),
];
