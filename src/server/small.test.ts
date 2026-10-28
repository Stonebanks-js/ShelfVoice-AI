import { describe, expect, it } from "vitest";

import { AUDIO_LIMITS, checkWav } from "./audio";
import { Changes, priceChangeAllowed, rupeesToPaise, toE164 } from "./changes";
import { DEMO_PRODUCTS, simulateHistory } from "./demo/template";
import { redact } from "./log";
import { slugFor } from "./shops";

function wav({ rate = 16000, channels = 1, bits = 16, seconds = 1, format = 1 } = {}) {
  const dataBytes = Math.round(seconds * rate) * channels * (bits / 8);
  const b = Buffer.alloc(44 + dataBytes);
  b.write("RIFF", 0); b.writeUInt32LE(36 + dataBytes, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(format, 20); b.writeUInt16LE(channels, 22); b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * channels * (bits / 8), 28); b.writeUInt16LE(channels * (bits / 8), 32); b.writeUInt16LE(bits, 34);
  b.write("data", 36); b.writeUInt32LE(dataBytes, 40);
  return new Uint8Array(b);
}

describe("WAV check (doc 03 TH-07)", () => {
  it("accepts 16 kHz mono 16-bit PCM and reports its length", () => {
    expect(checkWav(wav({ seconds: 2 }), AUDIO_LIMITS.command)).toEqual({ ok: true, info: { sampleRate: 16000, channels: 1, bitsPerSample: 16, durationMs: 2000 } });
    expect(checkWav(wav({ rate: 24000 }), AUDIO_LIMITS.command).ok).toBe(true);
  });

  it.each([
    ["stereo", { channels: 2 }, "must be mono 16-bit PCM"],
    ["8-bit", { bits: 8 }, "must be mono 16-bit PCM"],
    ["44.1 kHz", { rate: 44100 }, "must be 16 or 24 kHz"],
    ["compressed", { format: 3 }, "must be mono 16-bit PCM"],
  ])("rejects %s audio", (_name, opts, reason) => {
    expect(checkWav(wav(opts), AUDIO_LIMITS.command)).toEqual({ ok: false, reason });
  });

  it("rejects a 16-second review (limit 15 s) and anything that isn't WAV", () => {
    expect(checkWav(wav({ seconds: 16 }), AUDIO_LIMITS.review)).toEqual({ ok: false, reason: "too long" });
    expect(checkWav(new TextEncoder().encode("not audio at all, just text padding......"), AUDIO_LIMITS.review)).toEqual({ ok: false, reason: "not a WAV file" });
    expect(checkWav(new Uint8Array(2 * 1024 * 1024), AUDIO_LIMITS.review)).toEqual({ ok: false, reason: "too large" });
  });
});

describe("change contract", () => {
  it("converts spoken Indian numbers to E.164", () => {
    expect(toE164("98765 43210")).toBe("+919876543210");
    expect(toE164("+91 98765-43210")).toBe("+919876543210");
    expect(toE164("12345")).toBeNull();
    expect(toE164(null)).toBeNull();
  });

  it("allows a new price above 0 and under 10x the old one (doc 03)", () => {
    expect(priceChangeAllowed(1400, 1500)).toBe(true);
    expect(priceChangeAllowed(1400, 14000)).toBe(false);
    expect(priceChangeAllowed(null, 99999)).toBe(true);
    expect(rupeesToPaise(14.5)).toBe(1450);
  });

  it("refuses more than 50 changes and unknown ops", () => {
    const one = { op: "record_sale", product_id: "00000000-0000-4000-8000-000000000001", qty: 1 };
    expect(Changes.safeParse(Array(50).fill(one)).success).toBe(true);
    expect(Changes.safeParse(Array(51).fill(one)).success).toBe(false);
    expect(Changes.safeParse([{ op: "delete_everything" }]).success).toBe(false);
  });
});

describe("log redaction (doc 05)", () => {
  it("removes secrets, audio and transcripts at any depth", () => {
    expect(redact({ shopId: "s1", transcript: "hi", nested: { authorization: "Bearer x", ok: 1 }, list: [{ token: "t" }] })).toEqual({
      shopId: "s1",
      transcript: "[redacted]",
      nested: { authorization: "[redacted]", ok: 1 },
      list: [{ token: "[redacted]" }],
    });
    expect(redact(new Error("boom"))).toEqual({ name: "Error", message: "boom" });
  });
});

describe("storefront slugs (decision K5)", () => {
  it("builds a readable slug with 4 random characters", () => {
    expect(slugFor("Sharma Kirana Store", () => "k3f9")).toBe("sharma-kirana-store-k3f9");
    expect(slugFor("श्याम जनरल स्टोर", () => "ab12")).toBe("shop-ab12");
    expect(slugFor("Saini Medical & General Store!!", () => "0000")).toMatch(/^[a-z0-9-]{3,48}$/);
  });
});

describe("demo shop history", () => {
  const history = simulateHistory();

  it("never takes any product below zero and ends at the planned stock", () => {
    DEMO_PRODUCTS.forEach((product, index) => {
      let stock = 0;
      for (const m of history.filter((x) => x.productIndex === index)) {
        stock += m.kind === "SALE" ? -m.qty : m.qty;
        expect(stock).toBeGreaterThanOrEqual(0);
      }
      expect(stock).toBe(product.finalStock);
    });
  });

  it("is identical every run (fixed seed)", () => {
    expect(simulateHistory()).toEqual(history);
  });
});
