import type { ResolveBlockDefinition } from "@/contexts/cms";
import { authorizeActor } from "@/contexts/rbac";
import { IMPORT_EXPORT_REQUIRED_PERMISSIONS, IMPORT_MAX_ZIP_BYTES } from "../../../contracts/types";
import { parseExportZip } from "../../../zip-codec";
import { importSiteBundle } from "./service";
import type { ImportSiteBundleResult } from "./types";

// resolveDefinition não tem default aqui de propósito (ver comentário em types.ts) — quem chama
// (app/api/import-export/import/route.ts) importa resolveBlockDefinition de
// platform/page-builder/block-registry e passa, mesmo wiring que a tela de edição de entry já faz
// pra publish-entry normal.
//
// O .zip entra como leitura PREGUIÇOSA (readZipData) + tamanho declarado pelo cliente: o corpo só
// é lido depois do gate de permissão e da checagem de tamanho — um anônimo não consegue fazer o
// servidor bufferizar um upload de centenas de MB só pra receber 401 no fim.
export type ImportSiteBundleHandlerInput = {
  declaredSize: number | null;
  readZipData: () => Promise<Buffer>;
  resolveDefinition: ResolveBlockDefinition;
};

// Mesmo gate AND de export-site-bundle (ver comentário lá) — importar grava em cms + media, então
// exige as mesmas permissions de escrita completas, não só "qualquer uma".
export async function importSiteBundleHandler(input: ImportSiteBundleHandlerInput): Promise<ImportSiteBundleResult> {
  let actorId = "";
  for (const permission of IMPORT_EXPORT_REQUIRED_PERMISSIONS) {
    const authz = await authorizeActor(permission);
    if (!authz.authorized) {
      return { success: false, error: authz.error };
    }
    actorId = authz.actorId;
  }

  if (input.declaredSize === null) {
    return { success: false, error: { code: "import-export.length_required", message: "Envio sem tamanho declarado (Content-Length)." } };
  }
  if (input.declaredSize > IMPORT_MAX_ZIP_BYTES) {
    return {
      success: false,
      error: {
        code: "import-export.too_large",
        message: `O pacote passa do limite de ${Math.round(IMPORT_MAX_ZIP_BYTES / (1024 * 1024))} MB.`,
      },
    };
  }

  const zipData = await input.readZipData();
  if (zipData.byteLength === 0) {
    return { success: false, error: { code: "import-export.empty", message: "Selecione um arquivo .zip para importar." } };
  }
  if (zipData.byteLength > IMPORT_MAX_ZIP_BYTES) {
    return { success: false, error: { code: "import-export.too_large", message: "O pacote passa do limite de tamanho." } };
  }

  let parsedZip: ReturnType<typeof parseExportZip>;
  try {
    parsedZip = parseExportZip(zipData);
  } catch (error) {
    return {
      success: false,
      error: {
        code: "import-export.invalid_zip",
        message: error instanceof Error ? error.message : "Não foi possível ler o arquivo .zip enviado.",
      },
    };
  }

  return importSiteBundle({
    manifest: parsedZip.manifest,
    files: parsedZip.files,
    actorId,
    resolveDefinition: input.resolveDefinition,
  });
}
