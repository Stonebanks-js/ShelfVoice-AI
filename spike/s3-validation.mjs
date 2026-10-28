// Spike S3 follow-up: does /asr/transcribe reject unknown or invalid fields?
// Result (Oct 29): unknown fields and a bogus languageBias are accepted
// silently; only "mode" is validated. Usage: node spike/s3-validation.mjs
import { call, saveEvidence } from "./meta.mjs";
const rate = 16000, n = rate; const b = Buffer.alloc(44 + n * 2);
b.write("RIFF",0); b.writeUInt32LE(36+n*2,4); b.write("WAVEfmt ",8); b.writeUInt32LE(16,16); b.writeUInt16LE(1,20); b.writeUInt16LE(1,22); b.writeUInt32LE(rate,24); b.writeUInt32LE(rate*2,28); b.writeUInt16LE(2,32); b.writeUInt16LE(16,34); b.write("data",36); b.writeUInt32LE(n*2,40);
const tests = {
  "unknown-field": { model: "muse-voice-transcribe-1.0", audioEncoding: "WAV", notARealField: true },
  "bad-mode": { model: "muse-voice-transcribe-1.0", audioEncoding: "WAV", mode: "NOT_A_MODE" },
  "bad-languageBias": { model: "muse-voice-transcribe-1.0", audioEncoding: "WAV", languageBias: ["xx-not-a-language"] },
};
for (const [name, request] of Object.entries(tests)) {
  const form = new FormData();
  form.append("request", new Blob([JSON.stringify(request)], { type: "application/json" }), "request.json");
  form.append("audio", new Blob([b], { type: "audio/wav" }), "clip.wav");
  const res = await call("POST", "/asr/transcribe", { form, timeoutMs: 60000 });
  console.log(`${name}: HTTP ${res.status} | ${JSON.stringify(res.body?.error?.message ?? res.body).slice(0, 220)}`);
  saveEvidence(`s3-validation-${name}`, { ...res, sentRequestPart: request });
}
