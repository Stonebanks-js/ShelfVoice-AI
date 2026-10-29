import { api, ApiFailure } from "@/lib/api";

interface SignedUpload {
  bucket: string;
  path: string;
  signedUrl: string;
  token: string;
}

// Sends a recording straight to Storage through a signed URL (doc 02: files
// skip our server). The client picks the ID, so a retry overwrites the same
// object instead of making a second one (doc 07).
export async function uploadVoice(wav: Uint8Array<ArrayBuffer>, clientId: string = crypto.randomUUID()): Promise<string> {
  const upload = await api<SignedUpload>("/api/v1/uploads", { json: { kind: "voice", clientId } });
  let res: Response;
  try {
    res = await fetch(upload.signedUrl, {
      method: "PUT",
      headers: {
        "content-type": "audio/wav",
        "x-upsert": "true",
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      },
      body: wav,
      // A stalled upload must end, so the mic never stays on "Listening…".
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") throw new ApiFailure(0, "UPLOAD_TIMEOUT", "Upload timed out");
    throw new ApiFailure(0, "OFFLINE", "You're offline");
  }
  if (!res.ok) throw new ApiFailure(res.status, "UPLOAD_FAILED", `Storage returned ${res.status}`);
  return upload.path;
}
