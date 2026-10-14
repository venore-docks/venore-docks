import { getPublishedThemeConfig } from "./service";
import type { GetPublishedThemeConfigResult } from "./types";

// Leitura pública de propósito (sem authorizeActor): é o que todo request do site renderiza —
// mesmo racional de get-active-theme. Não expõe nada além do que o HTML já revela (tema, paleta).
export async function getPublishedThemeConfigHandler(): Promise<GetPublishedThemeConfigResult> {
  return getPublishedThemeConfig();
}
