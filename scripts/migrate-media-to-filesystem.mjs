// Migra a midia de uma instancia do driver "vercel-blob" para o driver "filesystem"
// (docs/media/filesystem-storage.md — "Migracao de vercel-blob para filesystem").
//
// O que faz, nesta ordem:
//   1. Le do banco todos os objetos de midia: media.assets (inclusive os com soft delete, que
//      ainda podem ser restaurados ou purgados) e media.asset_variants.
//   2. Baixa cada objeto e grava em MEDIA_FILESYSTEM_ROOT/<pathname>, com o sidecar
//      <pathname>.meta.json no mesmo formato do FilesystemStorageAdapter. Arquivo que ja existe
//      com o tamanho certo e pulado — rodar de novo continua de onde parou.
//   3. So com --apply E nenhum objeto faltando: regrava media.assets.url das linhas que ainda
//      apontam para o Blob, para a URL do driver filesystem (mesma regra de resolveUrl), numa
//      transacao. Linhas com URL da rota autorizada (/api/media/asset/<id>) nao mudam.
//
// De onde baixa: o app grava assets em Blob Store publico por padrao, entao a URL publica
// funciona sem token. Para cada key tenta, em ordem: a URL gravada no asset; a mesma key em cada
// host de Blob encontrado no banco (instancias antigas usaram mais de um store); e, se houver
// BLOB_READ_WRITE_TOKEN, o store dele (publico ou, com MEDIA_BLOB_ACCESS=private, via API).
//
// Uso (no servidor/container da instancia, com o volume de midia montado):
//   npm run media:migrate-to-filesystem               # simulacao: so lista o que faria
//   npm run media:migrate-to-filesystem -- --download # baixa os arquivos, nao mexe no banco
//   npm run media:migrate-to-filesystem -- --apply    # baixa o que faltar e regrava as URLs
//   ... -- --apply --allow-missing  # regrava mesmo com faltantes (os faltantes mantem a URL antiga)
//
// Saida sem acento de proposito (console de servidor com encoding incerto).
import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const DOWNLOAD = APPLY || args.has("--download");
const ALLOW_MISSING = args.has("--allow-missing");
const CONCURRENCY = Number(process.env.MIGRATE_MEDIA_CONCURRENCY) || 6;
const META_SUFFIX = ".meta.json";

const root = path.resolve(process.env.MEDIA_FILESYSTEM_ROOT?.trim() || "./media-storage");
const publicBase = (process.env.MEDIA_FILESYSTEM_PUBLIC_URL?.trim() || "/api/media/file").replace(/\/+$/, "");

function fail(message) {
  console.error(`\nERRO: ${message}`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) fail("DATABASE_URL nao esta definida.");

// Mesma regra de resolveWithinRoot (src/infrastructure/storage/filesystem-path.ts).
function resolveWithinRoot(key) {
  const target = path.resolve(root, key);
  return target === root || target.startsWith(root + path.sep) ? target : null;
}

// Mesma regra de FilesystemStorageAdapter.resolveUrl.
function filesystemUrl(key) {
  return `${publicBase}/${key.split("/").map((segment) => encodeURIComponent(segment)).join("/")}`;
}

function encodeKey(key) {
  return key.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function isBlobUrl(url) {
  try {
    return new URL(url).hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

// Host publico do store do token (mesma regra de VercelBlobAdapter.resolveUrl).
function tokenHost() {
  const storeId = process.env.BLOB_READ_WRITE_TOKEN?.trim().split("_").at(-2);
  return storeId ? `${storeId}.public.blob.vercel-storage.com` : null;
}

async function fetchOk(url) {
  try {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

let blobGet = null;
async function fetchWithToken(key) {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) return null;
  try {
    blobGet ??= (await import("@vercel/blob")).get;
    const access = process.env.MEDIA_BLOB_ACCESS === "private" ? "private" : "public";
    const result = await blobGet(key, { access, token });
    if (!result || result.statusCode !== 200) return null;
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  } catch {
    return null;
  }
}

async function download(object, hosts) {
  const candidates = [];
  if (object.url && isBlobUrl(object.url)) candidates.push(object.url);
  for (const host of hosts) candidates.push(`https://${host}/${encodeKey(object.pathname)}`);
  for (const url of [...new Set(candidates)]) {
    const data = await fetchOk(url);
    if (data) return data;
  }
  return fetchWithToken(object.pathname);
}

async function existingSize(target) {
  try {
    const info = await stat(target);
    return info.isFile() ? info.size : null;
  } catch {
    return null;
  }
}

async function writeObject(target, data, object) {
  await mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.part-${process.pid}`;
  await writeFile(temp, data);
  await rename(temp, target);
  await writeFile(
    `${target}${META_SUFFIX}`,
    JSON.stringify({ contentType: object.contentType, size: data.byteLength, uploadedAt: new Date(object.createdAt).toISOString() }),
  );
}

async function runPool(items, worker) {
  let index = 0;
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const { rows: assetRows } = await client.query(
      `select id, pathname, url, content_type as "contentType", size, created_at as "createdAt", deleted_at is not null as deleted
         from media.assets`,
    );
    const { rows: variantRows } = await client.query(
      `select v.id, v.pathname, null::text as url, v.content_type as "contentType", v.size, v.created_at as "createdAt"
         from media.asset_variants v`,
    );

    const hosts = new Set();
    const extra = tokenHost();
    if (extra) hosts.add(extra);
    for (const row of assetRows) {
      if (isBlobUrl(row.url)) hosts.add(new URL(row.url).hostname);
    }

    const skippedMemory = assetRows.filter((row) => row.url.startsWith("memory://"));
    const objects = [
      ...assetRows.filter((row) => !row.url.startsWith("memory://")).map((row) => ({ ...row, kind: "asset" })),
      ...variantRows.map((row) => ({ ...row, kind: "variant" })),
    ];

    console.log(`Raiz do filesystem: ${root}`);
    console.log(`Base das URLs:      ${publicBase}`);
    console.log(`Hosts de Blob:      ${[...hosts].join(", ") || "(nenhum)"}`);
    console.log(`Objetos: ${assetRows.length} assets + ${variantRows.length} variantes`);
    if (skippedMemory.length > 0) {
      console.log(`Ignorados (url memory://, sem arquivo em lugar nenhum): ${skippedMemory.map((row) => row.id).join(", ")}`);
    }

    const missing = [];
    const missingIds = new Set();
    const sizeMismatch = [];
    let downloaded = 0;
    let alreadyThere = 0;
    let invalid = 0;

    if (DOWNLOAD) {
      await mkdir(root, { recursive: true });
      await runPool(objects, async (object) => {
        const target = resolveWithinRoot(object.pathname);
        if (!target) {
          invalid += 1;
          missing.push(`${object.kind} ${object.id}: pathname fora da raiz (${object.pathname})`);
          return;
        }
        const current = await existingSize(target);
        if (current !== null && current === object.size) {
          alreadyThere += 1;
          return;
        }
        const data = await download(object, hosts);
        if (!data) {
          missing.push(`${object.kind} ${object.id}: ${object.pathname}`);
          if (object.kind === "asset") missingIds.add(object.id);
          return;
        }
        if (data.byteLength !== object.size) {
          sizeMismatch.push(`${object.kind} ${object.id}: banco=${object.size} baixado=${data.byteLength}`);
        }
        await writeObject(target, data, object);
        downloaded += 1;
        if (downloaded % 100 === 0) console.log(`  ... ${downloaded} baixados`);
      });

      console.log(`\nBaixados agora: ${downloaded}. Ja existiam: ${alreadyThere}. Faltando: ${missing.length}.`);
      if (sizeMismatch.length > 0) {
        console.log(`Tamanho diferente do banco (gravados mesmo assim): ${sizeMismatch.length}`);
        for (const line of sizeMismatch.slice(0, 20)) console.log(`  ${line}`);
      }
      if (missing.length > 0) {
        console.log("Objetos nao encontrados em nenhum host:");
        for (const line of missing) console.log(`  ${line}`);
      }
    } else {
      console.log("\nSimulacao: nada foi baixado. Use --download ou --apply.");
    }

    const toRewrite = assetRows.filter((row) => isBlobUrl(row.url) && !missingIds.has(row.id));
    console.log(`\nAssets com URL do Blob para regravar: ${toRewrite.length}`);

    if (!APPLY) {
      console.log("Banco nao alterado (sem --apply).");
      return;
    }
    if (invalid > 0) fail("ha pathname fora da raiz — o banco NAO foi alterado.");
    if (missing.length > 0 && !ALLOW_MISSING) {
      fail(
        "ha objetos faltando — o banco NAO foi alterado. Resolva os faltantes, ou rode com " +
          "--allow-missing para regravar o resto (os faltantes mantem a URL antiga).",
      );
    }

    await client.query("begin");
    try {
      for (const row of toRewrite) {
        await client.query("update media.assets set url = $1, updated_at = now() where id = $2", [
          filesystemUrl(row.pathname),
          row.id,
        ]);
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
    console.log(`OK: ${toRewrite.length} URLs regravadas para ${publicBase}/...`);
    console.log("Agora defina MEDIA_STORAGE_DRIVER=filesystem (se ainda nao estiver) e reinicie o app.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
