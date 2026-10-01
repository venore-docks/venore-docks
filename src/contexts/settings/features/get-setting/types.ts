import type { OperationResult } from "@/shared/types";
import type { SettingRecord } from "../../contracts/types";

// skipCache: pula o cache em memória (leitura E write-through). Para chaves lidas no root layout
// de TODA rota e cuja defasagem é imediatamente visível — hoje `theme.active`,
// `theme.activePaletteId` e `theme.customColorPalette`. O cache tem TTL de 300s e é POR PROCESSO;
// desde settings-cache-version.ts as outras instâncias descartam o cache em até 5 s depois de um
// `setSetting` (antes serviam o valor anterior por até 5 min — sintoma: "ao navegar, o tema às
// vezes volta pro anterior"). Pro tema, nem esses 5 s são aceitáveis: quem lê essas chaves já
// memoiza por request (React `cache()` em resolve-active-theme.ts), então pular o cache custa 1
// SELECT indexado. Para o resto, o cache com versão basta.
export type GetSettingQuery = { key: string; skipCache?: boolean };
export type GetSettingResult = OperationResult<SettingRecord | null>;
