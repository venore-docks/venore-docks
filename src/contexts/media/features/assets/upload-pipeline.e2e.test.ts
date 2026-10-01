import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../shared/attach-asset-variants", () => ({
  attachAssetVariants: async (assets: unknown[]) => assets,
  attachAssetVariantsToOne: async (asset: unknown) => asset,
}));
const generateAssetVariants = vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({ success: true, data: { generated: 0, skipped: true } }));
vi.mock("./generate-asset-variants/service", () => ({
  generateAssetVariants: (...args: unknown[]) => generateAssetVariants(...args),
}));
import { storagePort } from "@/infrastructure/storage";
import type { InMemoryStorageAdapter } from "@/infrastructure/storage/in-memory-storage-adapter";
import { computeSha256Hex } from "@/infrastructure/storage/checksum";

// Caminho principal ponta a ponta do pipeline de upload (docs/media/blob-spec.md), usando o
// InMemoryStorageAdapter real (não mockado) no lugar do Blob Store — só a camada de banco
// (register-uploaded-media/store) é substituída por um fake em memória, pra não depender de
// Postgres real neste teste unitário.
vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1", useCase: "test", actor: { id: "actor-1", type: "user" }, kind: "write", startedAt: new Date() })),
  endOperation: vi.fn(),
}));

const authorizeActor = vi.fn();
vi.mock("@/contexts/rbac", () => ({
  authorizeActor: (...args: unknown[]) => authorizeActor(...args),
}));

type FakeRow = {
  id: string;
  filename: string;
  pathname: string;
  url: string;
  contentType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  checksum: string;
  uploadedBy: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const fakeRows = new Map<string, FakeRow>();

vi.mock("./register-uploaded-media/store", () => ({
  findAssetByPathname: async (pathname: string) => fakeRows.get(pathname) ?? null,
  findActiveAssetByChecksum: async (checksum: string) => {
    for (const row of fakeRows.values()) {
      if (row.checksum === checksum && !row.deletedAt) return row;
    }
    return null;
  },
  insertAssetIfAbsent: async (input: Omit<FakeRow, "id" | "deletedAt" | "createdAt" | "updatedAt">) => {
    if (fakeRows.has(input.pathname)) return null;
    const row: FakeRow = { ...input, id: `asset-${fakeRows.size + 1}`, deletedAt: null, createdAt: new Date(), updatedAt: new Date() };
    fakeRows.set(input.pathname, row);
    return row;
  },
}));

describe("upload pipeline — caminho principal com InMemoryStorageAdapter", () => {
  beforeEach(() => {
    fakeRows.clear();
    authorizeActor.mockReset();
    authorizeActor.mockResolvedValue({ authorized: true, actorId: "actor-1" });
  });

  it("emite ticket, sobe o blob no adapter em memória e registra o asset de forma idempotente", async () => {
    const { requestMediaUploadTicketHandler } = await import("./request-media-upload-ticket/handler");
    const { registerUploadedMediaHandler } = await import("./register-uploaded-media/handler");

    // O MESMO storagePort que o service consulta (driver "local" em memória nos testes) — o
    // registro agora confere se o objeto existe no storage antes de criar a linha.
    const storage = storagePort as InMemoryStorageAdapter;
    const fileBytes = Buffer.from("%PDF-1.7\nconteúdo de teste do pipeline de upload");

    const ticket = await requestMediaUploadTicketHandler({ filename: "relatório final.pdf", contentType: "application/pdf", size: fileBytes.byteLength });
    expect(ticket.success).toBe(true);
    if (!ticket.success) return;

    const stored = await storage.store({ key: ticket.data.pathname, data: fileBytes, contentType: ticket.data.contentType });
    expect(storage.has(ticket.data.pathname)).toBe(true);

    const checksum = computeSha256Hex(fileBytes);

    const first = await registerUploadedMediaHandler({
      filename: "relatório final.pdf",
      pathname: stored.key,
      url: stored.url,
      contentType: ticket.data.contentType,
      size: stored.size,
      checksum,
      actorId: "actor-1",
    });
    expect(first.success).toBe(true);
    if (!first.success) return;
    expect(fakeRows.size).toBe(1);

    // Simula a segunda chamada idempotente (onUploadCompleted em produção, ou um retry do
    // browser) — mesmo pathname, não pode criar um segundo registro.
    const second = await registerUploadedMediaHandler({
      filename: "relatório final.pdf",
      pathname: stored.key,
      url: stored.url,
      contentType: ticket.data.contentType,
      size: stored.size,
      checksum,
      actorId: "actor-1",
    });
    expect(second.success).toBe(true);
    if (!second.success) return;
    expect(second.data.id).toBe(first.data.id);
    expect(fakeRows.size).toBe(1);
  });

  it("nega o ticket para um ator sem media.manage, sem afetar o storage nem o registro", async () => {
    authorizeActor.mockResolvedValue({ authorized: false, error: { code: "rbac.authorization.forbidden", message: "..." } });

    const { requestMediaUploadTicketHandler } = await import("./request-media-upload-ticket/handler");
    const ticket = await requestMediaUploadTicketHandler({ filename: "secreto.pdf", contentType: "application/pdf", size: 1024 });

    expect(ticket.success).toBe(false);
    expect(fakeRows.size).toBe(0);
  });
});
