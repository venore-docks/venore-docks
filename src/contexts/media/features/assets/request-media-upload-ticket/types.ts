import type { OperationResult } from "@/shared/types";

export type RequestMediaUploadTicketCommand = {
  filename: string;
  contentType: string;
  size: number;
  actorId: string;
};

export type RequestMediaUploadTicketInput = Omit<RequestMediaUploadTicketCommand, "actorId">;

// Como o browser sobe o arquivo (ver DirectUploadKind em infrastructure/storage):
// - "vercel-blob": upload() do @vercel/blob/client com handleUploadUrl "/api/media/upload";
// - "presigned-post": POST multipart pra `url` com `fields` + o arquivo no campo "file" (S3).
export type MediaDirectUpload =
  | { method: "vercel-blob" }
  | { method: "presigned-post"; url: string; fields: Record<string, string> };

export type MediaUploadTicket = {
  pathname: string;
  contentType: string;
  maxSizeBytes: number;
  directUpload: MediaDirectUpload;
};

export type RequestMediaUploadTicketResult = OperationResult<MediaUploadTicket>;
