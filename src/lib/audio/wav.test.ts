import { describe, expect, it } from "vitest";

import { AUDIO_LIMITS, checkWav } from "@/server/audio";

import { concat, encodeWav, resample, TARGET_RATE } from "./wav";

const tone = (rate: number, seconds: number, hz = 440) =>
  Float32Array.from({ length: Math.round(rate * seconds) }, (_, i) => 0.5 * Math.sin((2 * Math.PI * hz * i) / rate));

describe("browser WAV encoder (F-03)", () => {
  it.each([48_000, 44_100, 24_000, 16_000, 8_000])("turns %i Hz microphone audio into a WAV the server accepts", (rate) => {
    const wav = encodeWav(resample(tone(rate, 2), rate));
    const check = checkWav(wav, AUDIO_LIMITS.command);
    expect(check).toEqual({ ok: true, info: { sampleRate: TARGET_RATE, channels: 1, bitsPerSample: 16, durationMs: 2000 } });
  });

  it("keeps the tone's loudness when downsampling", () => {
    const out = resample(tone(48_000, 1), 48_000);
    const peak = Math.max(...out.map(Math.abs));
    expect(peak).toBeGreaterThan(0.45);
    expect(peak).toBeLessThanOrEqual(0.5);
  });

  it("clips samples outside -1..1 instead of wrapping", () => {
    const wav = encodeWav(Float32Array.from([2, -2, 0]));
    const view = new DataView(wav.buffer);
    expect(view.getInt16(44, true)).toBe(0x7fff);
    expect(view.getInt16(46, true)).toBe(-0x8000);
    expect(view.getInt16(48, true)).toBe(0);
  });

  it("a 30-second command stays inside the server's limits", () => {
    const wav = encodeWav(new Float32Array(TARGET_RATE * 30));
    expect(checkWav(wav, AUDIO_LIMITS.command).ok).toBe(true);
    expect(checkWav(encodeWav(new Float32Array(TARGET_RATE * 31)), AUDIO_LIMITS.command)).toEqual({ ok: false, reason: "too long" });
  });

  it("joins recorder chunks in order", () => {
    expect(Array.from(concat([Float32Array.from([1, 2]), Float32Array.from([3])]))).toEqual([1, 2, 3]);
  });
});
