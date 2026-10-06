import type { OperationResult } from "@/shared/types";
import type { MediaAsset } from "../../../contracts/types";

// Arquivo que o PRÓPRIO sistema gerou (áudio da leitura em voz alta), não um upload de alguém:
// sempre público, sem dono (uploadedBy null) e sempre numa categoria reservada do chamador.
export type StoreGeneratedAssetCommand = {
  filename: string;
  contentType: string;
  data: Buffer;
  categoryKey: string;
  categoryName: string;
};
export type StoreGeneratedAssetResult = OperationResult<MediaAsset>;

// Remoção do mesmo tipo de arquivo, sem soft delete: só apaga asset que esteja na categoria
// reservada informada — um id errado nunca alcança a biblioteca geral.
export type DeleteGeneratedAssetsCommand = { ids: string[]; categoryKey: string };
export type DeleteGeneratedAssetsResult = OperationResult<{ deleted: number }>;
