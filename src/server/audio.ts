// Server-side check of uploaded audio (doc 03 TH-07, upload table): read the
// WAV header itself instead of trusting the file name or content type.
export interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  durationMs: number;
}

export type WavCheck = { ok: true; info: WavInfo } | { ok: false; reason: string };

export function checkWav(bytes: Uint8Array, limits: { maxBytes: number; maxSeconds: number }): WavCheck {
  if (bytes.byteLength > limits.maxBytes) return { ok: false, reason: "too large" };
  if (bytes.byteLength < 44) return { ok: false, reason: "not a WAV file" };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") return { ok: false, reason: "not a WAV file" };

  // Walk the chunks: "fmt " describes the audio, "data" holds the samples.
  let offset = 12;
  let fmt: { format: number; channels: number; sampleRate: number; bitsPerSample: number } | undefined;
  let dataBytes: number | undefined;
  while (offset + 8 <= bytes.byteLength) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    if (id === "fmt " && offset + 24 <= bytes.byteLength) {
      fmt = {
        format: view.getUint16(offset + 8, true),
        channels: view.getUint16(offset + 10, true),
        sampleRate: view.getUint32(offset + 12, true),
        bitsPerSample: view.getUint16(offset + 22, true),
      };
    } else if (id === "data") {
      dataBytes = Math.min(size, bytes.byteLength - offset - 8);
      break;
    }
    offset += 8 + size + (size % 2);
  }

  if (!fmt || dataBytes === undefined) return { ok: false, reason: "not a WAV file" };
  // Doc 02: mono 16-bit PCM at 16 or 24 kHz, the only format Voice Transcribe takes.
  if (fmt.format !== 1 || fmt.channels !== 1 || fmt.bitsPerSample !== 16) return { ok: false, reason: "must be mono 16-bit PCM" };
  if (fmt.sampleRate !== 16000 && fmt.sampleRate !== 24000) return { ok: false, reason: "must be 16 or 24 kHz" };

  const durationMs = Math.round((dataBytes / (fmt.sampleRate * 2)) * 1000);
  if (durationMs > limits.maxSeconds * 1000) return { ok: false, reason: "too long" };
  return { ok: true, info: { sampleRate: fmt.sampleRate, channels: 1, bitsPerSample: 16, durationMs } };
}

// Doc 03 upload limits, with half a second of slack for the recorder's stop.
export const AUDIO_LIMITS = {
  setup: { maxBytes: 4 * 1024 * 1024, maxSeconds: 120.5 },
  command: { maxBytes: 4 * 1024 * 1024, maxSeconds: 30.5 },
  review: { maxBytes: 1024 * 1024, maxSeconds: 15.5 },
};
