import { describe, expect, it, vi } from "vitest";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { readS3StorageConfig, S3StorageAdapter, type S3StorageConfig } from "./s3-storage-adapter";

const BASE_CONFIG: S3StorageConfig = {
  bucket: "venore-midia",
  region: "sa-east-1",
  forcePathStyle: false,
  access: "private",
};

function fakeClient(handler: (command: unknown) => unknown) {
  const send = vi.fn(async (command: unknown) => handler(command));
  return { client: { send } as unknown as S3Client, send };
}

function s3Error(status: number, name: string) {
  return new S3ServiceException({ name, $fault: "client", $metadata: { httpStatusCode: status } });
}

describe("readS3StorageConfig", () => {
  it("exige S3_BUCKET", () => {
    expect(() => readS3StorageConfig({})).toThrow(/S3_BUCKET/);
  });

  it("exige as duas chaves de acesso juntas", () => {
    expect(() => readS3StorageConfig({ S3_BUCKET: "b", S3_ACCESS_KEY_ID: "x" })).toThrow(/juntas/);
  });

  it("usa a cadeia padrão da AWS sem chaves e lê os opcionais", () => {
    const config = readS3StorageConfig({
      S3_BUCKET: "b",
      S3_REGION: "sa-east-1",
      S3_PUBLIC_URL: "https://cdn.exemplo.com/",
      MEDIA_S3_ACCESS: "public",
    });
    expect(config).toMatchObject({ bucket: "b", region: "sa-east-1", publicBaseUrl: "https://cdn.exemplo.com", access: "public" });
    expect(config.credentials).toBeUndefined();
  });
});

describe("S3StorageAdapter", () => {
  it("store grava com escrita condicional e devolve a URL resolvida", async () => {
    const { client, send } = fakeClient(() => ({}));
    const adapter = new S3StorageAdapter(BASE_CONFIG, client);

    const stored = await adapter.store({ key: "images/a b.png", data: Buffer.from("x"), contentType: "image/png" });

    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({ Bucket: "venore-midia", Key: "images/a b.png", ContentType: "image/png", IfNoneMatch: "*" });
    expect(stored).toEqual({ key: "images/a b.png", url: "https://venore-midia.s3.sa-east-1.amazonaws.com/images/a%20b.png", size: 1 });
  });

  it("store com allowOverwrite não manda IfNoneMatch", async () => {
    const { client, send } = fakeClient(() => ({}));
    await new S3StorageAdapter(BASE_CONFIG, client).store({ key: "k", data: Buffer.from("x"), contentType: "image/png", allowOverwrite: true });
    expect((send.mock.calls[0][0] as PutObjectCommand).input.IfNoneMatch).toBeUndefined();
  });

  it("store traduz 412 (key já existe) num erro claro", async () => {
    const { client } = fakeClient(() => {
      throw s3Error(412, "PreconditionFailed");
    });
    await expect(new S3StorageAdapter(BASE_CONFIG, client).store({ key: "k", data: Buffer.from("x"), contentType: "image/png" })).rejects.toThrow(/Já existe/);
  });

  it("resolveUrl usa S3_PUBLIC_URL ou endpoint path-style quando configurados", () => {
    const { client } = fakeClient(() => ({}));
    expect(new S3StorageAdapter({ ...BASE_CONFIG, publicBaseUrl: "https://cdn.x" }, client).resolveUrl("a/b.png")).toBe("https://cdn.x/a/b.png");
    expect(
      new S3StorageAdapter({ ...BASE_CONFIG, endpoint: "http://minio:9000", forcePathStyle: true }, client).resolveUrl("a/b.png"),
    ).toBe("http://minio:9000/venore-midia/a/b.png");
  });

  it("stat e read devolvem null para objeto inexistente", async () => {
    const { client } = fakeClient(() => {
      throw s3Error(404, "NotFound");
    });
    const adapter = new S3StorageAdapter(BASE_CONFIG, client);
    expect(await adapter.stat("nada")).toBeNull();
    expect(await adapter.read("nada")).toBeNull();
  });

  it("stat devolve tamanho e tipo reais", async () => {
    const { client, send } = fakeClient(() => ({ ContentLength: 42, ContentType: "application/pdf" }));
    expect(await new S3StorageAdapter(BASE_CONFIG, client).stat("doc.pdf")).toEqual({ size: 42, contentType: "application/pdf" });
    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
  });

  it("read com range repassa o header e lê o total do Content-Range", async () => {
    const stream = new ReadableStream<Uint8Array>();
    const { client, send } = fakeClient(() => ({
      Body: { transformToWebStream: () => stream },
      ContentRange: "bytes 0-9/100",
      ContentLength: 10,
      ContentType: "video/mp4",
    }));
    const result = await new S3StorageAdapter(BASE_CONFIG, client).read("v.mp4", { start: 0, end: 9 });

    const command = send.mock.calls[0][0] as GetObjectCommand;
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command.input.Range).toBe("bytes=0-9");
    expect(result).toEqual({ body: stream, size: 100, contentType: "video/mp4", range: { start: 0, end: 9 } });
  });

  it("listObjects pagina até o fim", async () => {
    const pages = [
      { Contents: [{ Key: "a", Size: 1, LastModified: new Date("2026-01-01") }], IsTruncated: true, NextContinuationToken: "t" },
      { Contents: [{ Key: "b", Size: 2, LastModified: new Date("2026-01-02") }], IsTruncated: false },
    ];
    const { client, send } = fakeClient(() => pages.shift());
    const objects = await new S3StorageAdapter(BASE_CONFIG, client).listObjects("images/");

    expect(objects.map((object) => object.key)).toEqual(["a", "b"]);
    expect((send.mock.calls[1][0] as ListObjectsV2Command).input.ContinuationToken).toBe("t");
  });

  it("remove manda DeleteObject", async () => {
    const { client, send } = fakeClient(() => ({}));
    await new S3StorageAdapter(BASE_CONFIG, client).remove("k");
    expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
  });

  it("servesPublicly segue MEDIA_S3_ACCESS", () => {
    const { client } = fakeClient(() => ({}));
    expect(new S3StorageAdapter(BASE_CONFIG, client).servesPublicly()).toBe(false);
    expect(new S3StorageAdapter({ ...BASE_CONFIG, access: "public" }, client).servesPublicly()).toBe(true);
  });

  it("createUploadTicket assina um presigned POST com limite de tamanho e tipo", async () => {
    const client = new S3Client({ region: "sa-east-1", credentials: { accessKeyId: "AKIATEST", secretAccessKey: "secret" } });
    const adapter = new S3StorageAdapter(BASE_CONFIG, client);

    const ticket = await adapter.createUploadTicket({ key: "videos/x.mp4", contentType: "video/mp4", maxSizeBytes: 1000 });

    expect(adapter.directUploadKind()).toBe("presigned-post");
    expect(ticket.uploadUrl).toBe("https://venore-midia.s3.sa-east-1.amazonaws.com/");
    expect(ticket.fields).toMatchObject({ key: "videos/x.mp4", "Content-Type": "video/mp4" });
    const policy = JSON.parse(Buffer.from(ticket.fields!.Policy, "base64").toString("utf8")) as { conditions: unknown[] };
    expect(policy.conditions).toContainEqual(["content-length-range", 1, 1000]);
    expect(policy.conditions).toContainEqual(["eq", "$Content-Type", "video/mp4"]);
    expect(ticket.fields!["X-Amz-Signature"]).toMatch(/^[0-9a-f]{64}$/);
  });
});
