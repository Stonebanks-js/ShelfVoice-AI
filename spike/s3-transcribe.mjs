// Spike S3 (doc 09): find the exact multipart fields and response shape of
// POST /asr/transcribe. Sends a 16 kHz mono 16-bit WAV (doc 02 format).
// Usage: node spike/s3-transcribe.mjs [clip.wav]
//   With no clip, a 2-second 440 Hz tone is generated: enough to learn the
//   request and response shape, not to measure accuracy (that is S4).
import { readFileSync } from "node:fs";
import { call, saveEvidence } from "./meta.mjs";

function toneWav(seconds = 2, rate = 16000, freq = 440) {
  const samples = seconds * rate;
  const buf = Buffer.alloc(44 + samples * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36);
  buf.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 8000), 44 + i * 2);
  }
  return buf;
}

const clipPath = process.argv[2];
const audio = clipPath ? readFileSync(clipPath) : toneWav();

// First probe (saved as s3-file+model and s3-doc-07-fields) showed the
// endpoint wants two multipart parts: a JSON "request" and the "audio".
// Each attempt adds doc 07's settings so errors name any field it rejects.
// Next probe (s3-request-*) showed "audioEncoding" is required; its accepted
// values aren't documented, so try the usual names until one is accepted.
const base = {
  model: "muse-voice-transcribe-1.0",
  mode: "PUSH_TO_TALK",
  keywords: ["Maggi", "Parle-G", "Surf Excel"],
  languageBias: ["hi", "en"],
};
const attempts = ["WAV", "LINEAR16", "PCM_S16LE", "PCM"].map((encoding) => ({
  name: `encoding-${encoding}`,
  request: { ...base, audioEncoding: encoding, sampleRateHertz: 16000 },
}));

for (const attempt of attempts) {
  const form = new FormData();
  form.append("request", new Blob([JSON.stringify(attempt.request)], { type: "application/json" }), "request.json");
  form.append("audio", new Blob([audio], { type: "audio/wav" }), "clip.wav");
  const res = await call("POST", "/asr/transcribe", { form, timeoutMs: 60_000 });
  console.log(`${attempt.name}: HTTP ${res.status} in ${res.latencyMs} ms`);
  console.log(`  body: ${JSON.stringify(res.body).slice(0, 900)}`);
  console.log(`  evidence: ${saveEvidence(`s3-${attempt.name}`, { ...res, sentRequestPart: attempt.request, clip: clipPath ?? "generated 2 s 440 Hz tone" })}`);
  if (res.status === 200) break;
}
