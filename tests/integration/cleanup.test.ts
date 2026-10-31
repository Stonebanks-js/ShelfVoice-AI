// W-17b: the daily cleanup against the real local database and storage.
// Rows are backdated; stored files can't be, so for them the job runs with
// the clock moved forward ("frozen time", doc 04). Needs `supabase start`.
import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { admin, testOwner, toneWav } from "./helpers";

const { runCleanup, RETENTION } = await import("@/server/cleanup");

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);

describe("daily cleanup (W-17b)", () => {
  it("matches the privacy page", () => {
    expect(RETENTION).toMatchObject({ ownerVoiceDays: 7, reviewAudioDays: 30, photoDays: 30, ipHashDays: 7, proposalDays: 90, aiCallDays: 90 });
  });

  it("expires and deletes rows on the right day", { timeout: 120_000 }, async () => {
    const now = new Date();
    const at = (ms: number) => new Date(now.getTime() - ms).toISOString();
    const owner = await testOwner();
    const shop_id = owner.shop.id;

    const { data: proposals } = await admin
      .from("proposals")
      .insert([
        { shop_id, kind: "COMMAND", status: "PENDING", created_at: at(25 * HOUR) },
        { shop_id, kind: "COMMAND", status: "PENDING", created_at: at(23 * HOUR) },
        { shop_id, kind: "COMMAND", status: "CONFIRMED", created_at: at(91 * DAY) },
        { shop_id, kind: "COMMAND", status: "CONFIRMED", created_at: at(89 * DAY) },
      ])
      .select("id")
      .throwOnError();
    const [expiring, fresh, ancient, keptProposal] = proposals!.map((p) => p.id);

    const { data: calls } = await admin
      .from("ai_calls")
      .insert([
        { shop_id, job: "COMMAND", model: "muse-spark-1.3", outcome: "OK", created_at: at(91 * DAY) },
        { shop_id, job: "COMMAND", model: "muse-spark-1.3", outcome: "OK", created_at: at(89 * DAY) },
      ])
      .select("id")
      .throwOnError();

    const key = `test-cleanup:${randomUUID()}`;
    await admin
      .from("rate_limits")
      .insert([
        { key, window_start: at(3 * DAY), count: 1 },
        { key, window_start: at(1 * DAY), count: 1 },
      ])
      .throwOnError();

    const { data: reviews } = await admin
      .from("reviews")
      .insert([
        { shop_id, consent_at: at(8 * DAY), created_at: at(8 * DAY), ip_hash: "a".repeat(32) },
        { shop_id, consent_at: at(6 * DAY), created_at: at(6 * DAY), ip_hash: "b".repeat(32) },
      ])
      .select("id")
      .throwOnError();

    // Demo copies: one past its 24 hours, one not.
    const demo = async (expiresAt: string) => {
      const { data } = await admin.auth.admin.createUser({ email: `demo-${randomUUID()}@test.local`, email_confirm: true });
      const { data: shop } = await admin
        .from("shops")
        .insert({ owner_id: data.user!.id, name: "Demo", slug: `demo-${randomUUID().slice(0, 8)}`, is_demo: true, demo_expires_at: expiresAt })
        .select("id, owner_id")
        .single()
        .throwOnError();
      return shop!;
    };
    const expired = await demo(at(1 * HOUR));
    const current = await demo(new Date(now.getTime() + 23 * HOUR).toISOString());

    const result = await runCleanup(now);
    expect(result.failures).toBe(0);

    const status = async (id: string) => (await admin.from("proposals").select("status").eq("id", id).maybeSingle()).data?.status;
    expect(await status(expiring)).toBe("EXPIRED");
    expect(await status(fresh)).toBe("PENDING");
    expect(await status(ancient)).toBeUndefined();
    expect(await status(keptProposal)).toBe("CONFIRMED");

    const { data: leftCalls } = await admin.from("ai_calls").select("id").in("id", calls!.map((c) => c.id));
    expect(leftCalls!.map((c) => c.id)).toEqual([calls![1].id]);

    const { data: windows } = await admin.from("rate_limits").select("window_start").eq("key", key);
    expect(windows).toHaveLength(1);

    const hash = async (id: string) => (await admin.from("reviews").select("ip_hash").eq("id", id).single()).data?.ip_hash;
    expect(await hash(reviews![0].id)).toBeNull();
    expect(await hash(reviews![1].id)).toBe("b".repeat(32));

    const shopExists = async (id: string) => Boolean((await admin.from("shops").select("id").eq("id", id).maybeSingle()).data);
    expect(await shopExists(expired.id)).toBe(false);
    expect((await admin.auth.admin.getUserById(expired.owner_id)).data.user).toBeNull();
    expect(await shopExists(current.id)).toBe(true);
  });

  it("deletes recordings and photos on the right day", { timeout: 240_000 }, async () => {
    const owner = await testOwner();
    const shopId = owner.shop.id;
    const put = async (bucket: "voice" | "photos", path: string, body: Uint8Array, contentType: string) => {
      const { error } = await admin.storage.from(bucket).upload(path, body, { contentType });
      if (error) throw error;
      return path;
    };
    const wav = toneWav(1);

    const voiceNote = await put("voice", `${shopId}/owner/${randomUUID()}.wav`, wav, "audio/wav");
    const unusedVoice = await put("voice", `${shopId}/owner/${randomUUID()}.wav`, wav, "audio/wav");
    const bill = await put("photos", `${shopId}/bill/${randomUUID()}.jpg`, jpeg, "image/jpeg");
    const unusedPhoto = await put("photos", `${shopId}/shelf/${randomUUID()}.jpg`, jpeg, "image/jpeg");
    const reviewId = randomUUID();
    const reviewAudio = await put("voice", `${shopId}/reviews/${reviewId}.wav`, wav, "audio/wav");
    const leftover = await put("photos", `${randomUUID()}/bill/${randomUUID()}.jpg`, jpeg, "image/jpeg");

    await admin
      .from("proposals")
      .insert([
        { shop_id: shopId, kind: "COMMAND", input_path: voiceNote },
        { shop_id: shopId, kind: "BILL", input_path: bill },
      ])
      .throwOnError();
    await admin.from("reviews").insert({ id: reviewId, shop_id: shopId, audio_path: reviewAudio, consent_at: new Date().toISOString() }).throwOnError();

    const exists = async (bucket: "voice" | "photos", path: string) => {
      const slash = path.lastIndexOf("/");
      const { data } = await admin.storage.from(bucket).list(path.slice(0, slash), { search: path.slice(slash + 1) });
      return (data ?? []).some((f) => f.name === path.slice(slash + 1));
    };
    const later = (ms: number) => new Date(Date.now() + ms);

    // Nothing is touched within the first day.
    expect((await runCleanup(later(23 * HOUR))).failures).toBe(0);
    for (const [bucket, path] of [["voice", unusedVoice], ["photos", unusedPhoto], ["photos", leftover]] as const) {
      expect(await exists(bucket, path)).toBe(true);
    }

    // After a day: uploads nothing uses, and files of a shop that's gone.
    expect((await runCleanup(later(25 * HOUR))).failures).toBe(0);
    expect(await exists("voice", unusedVoice)).toBe(false);
    expect(await exists("photos", unusedPhoto)).toBe(false);
    expect(await exists("photos", leftover)).toBe(false);
    expect(await exists("voice", voiceNote)).toBe(true);

    // After 7 days: the owner's voice note; the photo and review stay.
    expect((await runCleanup(later(7 * DAY + HOUR))).failures).toBe(0);
    expect(await exists("voice", voiceNote)).toBe(false);
    expect(await exists("photos", bill)).toBe(true);
    expect(await exists("voice", reviewAudio)).toBe(true);

    // After 30 days: the bill photo and the review audio, marked on the review.
    expect((await runCleanup(later(30 * DAY + HOUR))).failures).toBe(0);
    expect(await exists("photos", bill)).toBe(false);
    expect(await exists("voice", reviewAudio)).toBe(false);
    const { data: review } = await admin.from("reviews").select("audio_deleted_at").eq("id", reviewId).single();
    expect(review?.audio_deleted_at).not.toBeNull();
  });
});
