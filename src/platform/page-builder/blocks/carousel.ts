import type { BlockDefinition } from "@/contexts/cms";
import { CARD_BLOCK_KEY } from "./card";
import { IMAGE_BLOCK_KEY } from "./image";

export const CAROUSEL_BLOCK_KEY = "core.layout.carousel";

// Mesmo padrão de areas de gallery.ts — só o renderer muda (slides com autoplay/drag em vez de
// grid). Ver carousel-block-client.tsx para o porquê da fronteira client.
export const carouselBlockDefinition: BlockDefinition = {
  key: CAROUSEL_BLOCK_KEY,
  label: "Carrossel",
  category: "estrutura",
  structure: "areas",
  allowedInRoot: true,
  defaultData: { autoplay: false, interval: 5, loop: true, showDots: true, perView: "1" },
  editorFields: [
    { name: "autoplay", type: "boolean", label: "Avançar automaticamente" },
    { name: "interval", type: "number", label: "Intervalo (segundos)" },
    {
      name: "perView",
      type: "select",
      label: "Slides visíveis (desktop)",
      options: [
        { value: "1", label: "1" },
        { value: "2", label: "2" },
        { value: "3", label: "3" },
        { value: "4", label: "4" },
      ],
    },
    { name: "loop", type: "boolean", label: "Loop contínuo" },
    { name: "showDots", type: "boolean", label: "Mostrar indicadores" },
  ],
  areaDefinitions: [{ key: "items", label: "Slides", allowedBlockKeys: [IMAGE_BLOCK_KEY, CARD_BLOCK_KEY] }],
};
