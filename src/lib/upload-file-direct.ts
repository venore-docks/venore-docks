import { upload } from "@vercel/blob/client";

type DirectUploadTicket = {
  pathname: string;
  contentType: string;
  directUpload: { method: "vercel-blob" } | { method: "presigned-post"; url: string; fields: Record<string, string> };
};

// Sobe um arquivo grande direto do browser pro storage, conforme o ticket que o servidor emitiu
// (contexts/media requestMediaUploadTicket). O registro do asset vem depois, pela action de
// confirmação — que confere tamanho/tipo REAIS no storage (stat), nunca o que o browser diz.
export async function uploadFileDirect(ticket: DirectUploadTicket, file: File): Promise<{ pathname: string; url: string }> {
  if (ticket.directUpload.method === "presigned-post") {
    const form = new FormData();
    for (const [name, value] of Object.entries(ticket.directUpload.fields)) form.append(name, value);
    // "file" precisa ser o último campo do multipart (regra do POST do S3).
    form.append("file", file);
    const response = await fetch(ticket.directUpload.url, { method: "POST", body: form });
    if (!response.ok) {
      throw new Error(`O storage recusou o upload (HTTP ${response.status}).`);
    }
    return { pathname: ticket.pathname, url: `${ticket.directUpload.url.replace(/\/+$/, "")}/${ticket.pathname}` };
  }

  const blob = await upload(ticket.pathname, file, {
    access: "public",
    handleUploadUrl: "/api/media/upload",
    contentType: ticket.contentType,
    clientPayload: JSON.stringify({ filename: file.name, contentType: ticket.contentType, size: file.size }),
  });
  return { pathname: blob.pathname, url: blob.url };
}
