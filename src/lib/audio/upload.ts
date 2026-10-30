import { api, ApiFailure } from "@/lib/api";

interface SignedUpload {
  bucket: string;
  path: string;
  signedUrl: string;
  token: string;
}

export type UploadKind = "voice" | "bill" | "shelf";

// Sends a file straight to Storage through a signed URL (doc 02: files skip
// our server). The client picks the ID, so a retry overwrites the same
// object instead of making a second one (doc 07).
export async function uploadFile(
  kind: UploadKind,
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string,
  clientId: string = crypto.randomUUID(),
): Promise<string> {
  const upload = await api<SignedUpload>("/api/v1/uploads", { json: { kind, clientId } });
  let res: Response;
  try {
    res = await fetch(upload.signedUrl, {
      method: "PUT",
      headers: {
        "content-type": contentType,
        "x-upsert": "true",
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      },
      body: bytes,
      // A stalled upload must end, so the screen never stays on "Sending…".
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") throw new ApiFailure(0, "UPLOAD_TIMEOUT", "Upload timed out");
    throw new ApiFailure(0, "OFFLINE", "You're offline");
  }
  if (!res.ok) throw new ApiFailure(res.status, "UPLOAD_FAILED", `Storage returned ${res.status}`);
  return upload.path;
}

export const uploadVoice = (wav: Uint8Array<ArrayBuffer>, clientId?: string) => uploadFile("voice", wav, "audio/wav", clientId);
