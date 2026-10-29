// Server services against the real local database and storage, with only
// the Meta client replaced (doc 04 "Mocking rules": only src/server/ai is
// mocked; Supabase never is). Needs `supabase start`.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AiError } from "@/server/ai/meta";

import { admin, testOwner, toneWav } from "./helpers";

const fake = {
  transcribe: vi.fn(),
  structured: vi.fn(),
  tools: vi.fn(),
};
vi.mock("@/server/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/ai")>()),
  meta: () => fake,
}));

const { createDemoCopy } = await import("@/server/demo/copy");
const { refreshForecasts } = await import("@/server/forecast/refresh");
const proposals = await import("@/server/proposals");
const { storeReview, analyseStoredReview } = await import("@/server/reviews");
const { limit } = await import("@/server/abuse");
const { ledger } = await import("@/server/ai/index");
const { ApiError } = await import("@/server/http");

beforeEach(() => {
  fake.transcribe.mockReset();
  fake.structured.mockReset();
  fake.tools.mockReset();
});

async function uploadClip(owner: Awaited<ReturnType<typeof testOwner>>, audio = toneWav()) {
  const upload = await proposals.signedUpload(owner, "voice", randomUUID());
  const { error } = await owner.db.storage.from("voice").uploadToSignedUrl(upload.path, upload.token, audio, { contentType: "audio/wav" });
  if (error) throw error;
  return upload.path;
}

describe("demo copy and forecasts", () => {
  it("gives a demo user their own seeded shop with forecasts", async () => {
    const owner = await testOwner(false);
    const shopId = await createDemoCopy(owner.user.id);
    const { data: products } = await owner.db.from("products").select("name, stock_qty, product_forecasts(order_qty, stockout_boost_until)").eq("shop_id", shopId);
    expect(products).toHaveLength(15);
    const atta = products!.find((p) => p.name === "Aashirvaad Atta")!;
    const forecast = Array.isArray(atta.product_forecasts) ? atta.product_forecasts[0] : atta.product_forecasts;
    expect(atta.stock_qty).toBe(3);
    expect(forecast?.order_qty).toBeGreaterThan(0);
    expect(forecast?.stockout_boost_until).not.toBeNull();
    expect(await refreshForecasts(shopId)).toBe(15);
  });

  // 18:42 IST: today's 6 pm sales must not land tomorrow and break the forecast.
  it("seeds an evening demo copy without future movements", async () => {
    const owner = await testOwner(false);
    const now = new Date("2026-10-29T13:12:00Z");
    const shopId = await createDemoCopy(owner.user.id, now);
    const { data: latest } = await admin.from("stock_movements").select("occurred_at").eq("shop_id", shopId).order("occurred_at", { ascending: false }).limit(1).single();
    expect(new Date(latest!.occurred_at).getTime()).toBeLessThanOrEqual(now.getTime());
    const { count } = await admin.from("product_forecasts").select("product_id", { count: "exact", head: true }).eq("shop_id", shopId);
    expect(count).toBe(15);
  });

  it("returns 0 for a shop with no products", async () => {
    const owner = await testOwner();
    expect(await refreshForecasts(owner.shop.id)).toBe(0);
  });
});

describe("voice proposals", () => {
  it("reports nothing heard for silence", async () => {
    const owner = await testOwner();
    const clip = await uploadClip(owner);
    fake.transcribe.mockResolvedValue({ transcript: "  ", audioDurationMs: 2000 });
    await expect(proposals.voiceProposal(owner, clip, "COMMAND")).rejects.toMatchObject({ code: "NOTHING_HEARD" });
  });

  it("turns a command into a pending proposal, once per clip", async () => {
    const owner = await testOwner();
    const { data: maggi } = await owner.db.from("products").insert({ shop_id: owner.shop.id, name: "Maggi", price_paise: 1400, stock_qty: 10 }).select("id").single();
    const clip = await uploadClip(owner);
    fake.transcribe.mockResolvedValue({ transcript: "Maggi ka price 15 kar do", audioDurationMs: 2000 });
    fake.tools.mockResolvedValue({ calls: [{ name: "update_price", arguments: { product_id: maggi!.id, price_rupees: 15 } }] });

    const first = await proposals.voiceProposal(owner, clip, "COMMAND");
    expect(first.proposal.status).toBe("PENDING");
    expect(first.proposal.changes).toEqual([{ op: "update_price", product_id: maggi!.id, price_paise: 1500 }]);

    const again = await proposals.voiceProposal(owner, clip, "COMMAND");
    expect(again.proposal.id).toBe(first.proposal.id);
    expect(fake.transcribe).toHaveBeenCalledTimes(1);

    const applied = await proposals.confirmProposal(owner, first.proposal.id);
    expect(applied[0]).toMatchObject({ op: "update_price", after: { price_paise: 1500 } });
    const reverted = await proposals.undoProposal(owner, first.proposal.id);
    expect(reverted[0].undo).toBe("reverted");
    expect(proposals.touchedProducts(reverted)).toEqual([maggi!.id]);
  });

  it("turns a setup description into profile and product changes", async () => {
    const owner = await testOwner();
    const clip = await uploadClip(owner);
    fake.transcribe.mockResolvedValue({ transcript: "Sharma Kirana, Maggi 14 rupaye", audioDurationMs: 3000 });
    fake.structured.mockResolvedValue({
      shop: { name: "Sharma Kirana", category: null, address: null, phone: "98765 43210" },
      hours: [{ days: ["mon", "tue"], open: "07:00", close: "22:00" }],
      products: [{ name: "Maggi", unit: "70 g", price_rupees: 14, category: "Snacks" }],
    });
    const { proposal } = await proposals.voiceProposal(owner, clip, "SETUP");
    expect(proposal.kind).toBe("SETUP");
    expect(proposal.changes).toEqual([
      { op: "update_shop", name: "Sharma Kirana", phone: "+919876543210", hours: { mon: [["07:00", "22:00"]], tue: [["07:00", "22:00"]] } },
      { op: "add_product", name: "Maggi", unit: "70 g", category: "Snacks", price_paise: 1400 },
    ]);
    await proposals.confirmProposal(owner, proposal.id);
    const { data: shop } = await owner.db.from("shops").select("name, phone").single();
    expect(shop).toEqual({ name: "Sharma Kirana", phone: "+919876543210" });
  });

  it("refuses clips from someone else's folder and bad audio", async () => {
    const owner = await testOwner();
    await expect(proposals.voiceProposal(owner, `${randomUUID()}/owner/${randomUUID()}.wav`, "COMMAND")).rejects.toMatchObject({ code: "BAD_PATH" });
    const stereo = toneWav();
    stereo[22] = 2; // channel count
    const clip = await uploadClip(owner, stereo);
    await expect(proposals.voiceProposal(owner, clip, "COMMAND")).rejects.toMatchObject({ code: "BAD_AUDIO" });
  });

  it("explains a paused AI budget instead of failing", async () => {
    const owner = await testOwner();
    const clip = await uploadClip(owner);
    fake.transcribe.mockRejectedValue(new AiError("AI_PAUSED", "paused"));
    await expect(proposals.voiceProposal(owner, clip, "COMMAND")).rejects.toMatchObject({ status: 503, code: "AI_PAUSED" });
    fake.transcribe.mockRejectedValue(new AiError("AI_BAD_OUTPUT", "bad"));
    const clip2 = await uploadClip(owner);
    await expect(proposals.voiceProposal(owner, clip2, "COMMAND")).rejects.toMatchObject({ status: 422, code: "AI_NOT_UNDERSTOOD" });
  });

  it("refuses a confirmed price more than 10x the old one", async () => {
    const owner = await testOwner();
    const { data: p } = await owner.db.from("products").insert({ shop_id: owner.shop.id, name: "Salt", price_paise: 2800 }).select("id").single();
    const { data: prop } = await owner.db.from("proposals").insert({ shop_id: owner.shop.id, kind: "COMMAND" }).select("id").single();
    await expect(
      proposals.confirmProposal(owner, prop!.id, [{ op: "update_price", product_id: p!.id, price_paise: 280000 }]),
    ).rejects.toMatchObject({ code: "PRICE_OUT_OF_RANGE" });
    await expect(proposals.confirmProposal(owner, randomUUID())).rejects.toMatchObject({ status: 404 });
    await expect(proposals.undoProposal(owner, randomUUID())).rejects.toMatchObject({ status: 404 });
  });
});

describe("bill proposals", () => {
  it("reads a bill photo into delivery lines", async () => {
    const owner = await testOwner();
    const { data: p } = await owner.db.from("products").insert({ shop_id: owner.shop.id, name: "Parle-G", stock_qty: 10 }).select("id").single();
    const upload = await proposals.signedUpload(owner, "bill", randomUUID());
    const jpeg = readFileSync(path.join(process.cwd(), "tests/fixtures/bills/printed-1.jpg"));
    await owner.db.storage.from("photos").uploadToSignedUrl(upload.path, upload.token, jpeg, { contentType: "image/jpeg" });
    fake.structured.mockResolvedValue({
      lines: [
        { name: "Parle-G", qty: 48, unit: "pcs", product_id: p!.id },
        { name: "Haldiram Bhujia", qty: 12, unit: "pkt", product_id: null },
        { name: "Smudged line", qty: null, unit: null, product_id: null },
      ],
    });
    const { proposal } = await proposals.billProposal(owner, upload.path);
    expect(proposal.kind).toBe("BILL");
    expect(proposal.changes).toEqual([
      { op: "record_delivery", product_id: p!.id, qty: 48 },
      { op: "add_product", name: "Haldiram Bhujia", unit: "pkt", stock_qty: 12 },
    ]);
    await proposals.confirmProposal(owner, proposal.id);
    const { data: after } = await owner.db.from("products").select("stock_qty").eq("id", p!.id).single();
    expect(after!.stock_qty).toBe(58);
    expect((await proposals.billProposal(owner, upload.path)).proposal.id).toBe(proposal.id);
  });

  it("rejects a file that isn't a JPEG", async () => {
    const owner = await testOwner();
    const upload = await proposals.signedUpload(owner, "bill", randomUUID());
    await owner.db.storage.from("photos").uploadToSignedUrl(upload.path, upload.token, new Uint8Array([1, 2, 3, 4]), { contentType: "image/jpeg" });
    await expect(proposals.billProposal(owner, upload.path)).rejects.toMatchObject({ code: "BAD_IMAGE" });
  });
});

describe("customer reviews", () => {
  it("stores a review once, then analyses it and boosts flagged items", async () => {
    const owner = await testOwner();
    const { data: atta } = await owner.db.from("products").insert({ shop_id: owner.shop.id, name: "Atta", stock_qty: 3 }).select("id").single();
    const reviewId = randomUUID();
    const submission = { reviewId, consent: true, audio: toneWav(3), ipHash: "hash" };
    expect(await storeReview(owner.shop.id, submission)).toBe(true);
    expect(await storeReview(owner.shop.id, submission)).toBe(false);

    fake.transcribe.mockResolvedValue({ transcript: "Atta khatam tha", audioDurationMs: 3000 });
    fake.structured.mockResolvedValue({ sentiment: "NEGATIVE", summary: "Atta was out of stock.", mentioned_product_ids: [atta!.id], stockout_product_ids: [atta!.id, randomUUID()] });
    expect(await analyseStoredReview(reviewId)).toBe("ANALYZED");

    const { data: review } = await owner.db.from("reviews").select("status, sentiment, stockout_product_ids").eq("id", reviewId).single();
    expect(review).toEqual({ status: "ANALYZED", sentiment: "NEGATIVE", stockout_product_ids: [atta!.id] });
    const { data: forecast } = await owner.db.from("product_forecasts").select("stockout_boost_until").eq("product_id", atta!.id).single();
    expect(forecast!.stockout_boost_until).not.toBeNull();
    expect(await analyseStoredReview(reviewId)).toBe("ANALYZED");
  });

  it("requires consent and a valid clip", async () => {
    const owner = await testOwner();
    await expect(storeReview(owner.shop.id, { reviewId: randomUUID(), consent: false, audio: toneWav(), ipHash: "h" })).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
    await expect(storeReview(owner.shop.id, { reviewId: randomUUID(), consent: true, audio: toneWav(16), ipHash: "h" })).rejects.toMatchObject({ code: "BAD_AUDIO" });
  });

  it("notes silence, and keeps a review pending when the AI fails", async () => {
    const owner = await testOwner();
    const quiet = randomUUID();
    await storeReview(owner.shop.id, { reviewId: quiet, consent: true, audio: toneWav(), ipHash: "h" });
    fake.transcribe.mockResolvedValue({ transcript: "", audioDurationMs: 2000 });
    expect(await analyseStoredReview(quiet)).toBe("ANALYZED");

    const failing = randomUUID();
    await storeReview(owner.shop.id, { reviewId: failing, consent: true, audio: toneWav(), ipHash: "h" });
    fake.transcribe.mockRejectedValue(new AiError("AI_UNAVAILABLE", "down"));
    expect(await analyseStoredReview(failing)).toBe("PENDING");
    expect(await analyseStoredReview(randomUUID())).toBe("FAILED");
  });
});

describe("rate limits and the AI ledger", () => {
  it("allows up to the limit, then refuses with 429", async () => {
    const key = `test:${randomUUID()}`;
    for (let i = 0; i < 3; i++) await limit(key, 3, 3600);
    await expect(limit(key, 3, 3600)).rejects.toBeInstanceOf(ApiError);
    await expect(limit(key, 3, 3600)).rejects.toMatchObject({ status: 429 });
  });

  it("records calls, sums spend, and keeps breaker state", async () => {
    const owner = await testOwner();
    const before = await ledger.spend(owner.shop.id);
    await ledger.record({
      ctx: { job: "COMMAND", shopId: owner.shop.id, requestId: "r1" },
      model: "muse-spark-1.3",
      inputTokens: 100,
      cachedTokens: 0,
      outputTokens: 20,
      audioSeconds: 0,
      costUsd: 0.25,
      latencyMs: 900,
      retries: 0,
      outcome: "OK",
    });
    const after = await ledger.spend(owner.shop.id);
    expect(after.shopTodayUsd - before.shopTodayUsd).toBeCloseTo(0.25, 6);
    expect(after.totalUsd - before.totalUsd).toBeCloseTo(0.25, 6);

    const provider = `test-${randomUUID()}`;
    expect(await ledger.breaker(provider)).toEqual({ state: "CLOSED", failures: 0, openedAt: null });
    const openedAt = new Date();
    await ledger.saveBreaker(provider, { state: "OPEN", failures: 5, openedAt });
    expect(await ledger.breaker(provider)).toEqual({ state: "OPEN", failures: 5, openedAt });
    await admin.from("ai_breaker").delete().eq("provider", provider);
  });
});
