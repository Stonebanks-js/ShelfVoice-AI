import "server-only";

import { deleteShop } from "./delete-shop";
import { log } from "./log";
import { adminClient } from "./supabase";

// Daily cleanup (W-17b; doc 03 data inventory, doc 07 data lifecycle,
// errata E-08, E-12). These are the promises on the privacy page
// (src/app/privacy/content.ts): change both together.
export const RETENTION = {
  ownerVoiceDays: 7,
  reviewAudioDays: 30,
  photoDays: 30,
  ipHashDays: 7,
  proposalDays: 90,
  aiCallDays: 90,
  rateLimitDays: 2,
  pendingProposalHours: 24,
  // Uploaded but never turned into a proposal or a review.
  unusedUploadHours: 24,
} as const;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const BATCH = 500;

export interface CleanupResult {
  proposalsExpired: number;
  proposalsDeleted: number;
  aiCallsDeleted: number;
  rateLimitsDeleted: number;
  ipHashesCleared: number;
  demoShopsDeleted: number;
  ownerVoiceDeleted: number;
  reviewAudioDeleted: number;
  photosDeleted: number;
  unusedUploadsDeleted: number;
  leftoverFilesDeleted: number;
  failures: number;
}

interface StoredFile {
  path: string;
  createdAt: number;
}

const ago = (now: Date, ms: number) => new Date(now.getTime() - ms).toISOString();

// Folders and files one level under `prefix` (Storage lists one level at a time).
async function listLevel(bucket: string, prefix: string) {
  const storage = adminClient().storage.from(bucket);
  const folders: string[] = [];
  const files: StoredFile[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await storage.list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Folders come back without an id. A file with no creation time is
      // never treated as old.
      if (entry.id === null) folders.push(path);
      else files.push({ path, createdAt: entry.created_at ? Date.parse(entry.created_at) : Infinity });
    }
    if (data.length < 1000) return { folders, files };
  }
}

async function listAll(bucket: string, prefix: string): Promise<StoredFile[]> {
  const { folders, files } = await listLevel(bucket, prefix);
  for (const folder of folders) files.push(...(await listAll(bucket, folder)));
  return files;
}

async function remove(bucket: string, paths: string[]) {
  for (let i = 0; i < paths.length; i += BATCH) {
    const { error } = await adminClient().storage.from(bucket).remove(paths.slice(i, i + BATCH));
    if (error) throw error;
  }
  return paths.length;
}

// Runs every step even if one fails, so one bad row never stops the rest;
// each failure is logged and counted for the heartbeat.
export async function runCleanup(now = new Date()): Promise<CleanupResult> {
  const db = adminClient();
  const result: CleanupResult = {
    proposalsExpired: 0,
    proposalsDeleted: 0,
    aiCallsDeleted: 0,
    rateLimitsDeleted: 0,
    ipHashesCleared: 0,
    demoShopsDeleted: 0,
    ownerVoiceDeleted: 0,
    reviewAudioDeleted: 0,
    photosDeleted: 0,
    unusedUploadsDeleted: 0,
    leftoverFilesDeleted: 0,
    failures: 0,
  };
  const step = async (name: string, run: () => Promise<void>) => {
    try {
      await run();
    } catch (error) {
      result.failures += 1;
      log("error", "cleanup.step_failed", { step: name, error });
    }
  };

  await step("expire_proposals", async () => {
    const { count, error } = await db
      .from("proposals")
      .update({ status: "EXPIRED", decided_at: now.toISOString() }, { count: "exact" })
      .eq("status", "PENDING")
      .lt("created_at", ago(now, RETENTION.pendingProposalHours * HOUR_MS));
    if (error) throw error;
    result.proposalsExpired = count ?? 0;
  });

  await step("delete_proposals", async () => {
    const { count, error } = await db.from("proposals").delete({ count: "exact" }).lt("created_at", ago(now, RETENTION.proposalDays * DAY_MS));
    if (error) throw error;
    result.proposalsDeleted = count ?? 0;
  });

  await step("delete_ai_calls", async () => {
    const { count, error } = await db.from("ai_calls").delete({ count: "exact" }).lt("created_at", ago(now, RETENTION.aiCallDays * DAY_MS));
    if (error) throw error;
    result.aiCallsDeleted = count ?? 0;
  });

  await step("delete_rate_limits", async () => {
    const { count, error } = await db.from("rate_limits").delete({ count: "exact" }).lt("window_start", ago(now, RETENTION.rateLimitDays * DAY_MS));
    if (error) throw error;
    result.rateLimitsDeleted = count ?? 0;
  });

  await step("clear_ip_hashes", async () => {
    const { count, error } = await db
      .from("reviews")
      .update({ ip_hash: null }, { count: "exact" })
      .not("ip_hash", "is", null)
      .lt("created_at", ago(now, RETENTION.ipHashDays * DAY_MS));
    if (error) throw error;
    result.ipHashesCleared = count ?? 0;
  });

  await step("delete_demo_shops", async () => {
    const { data, error } = await db
      .from("shops")
      .select("id, owner_id")
      .eq("is_demo", true)
      .lt("demo_expires_at", now.toISOString())
      .limit(BATCH);
    if (error) throw error;
    for (const shop of data) {
      await deleteShop({ shopId: shop.id, userId: shop.owner_id, requestId: "cleanup" });
      result.demoShopsDeleted += 1;
    }
  });

  // Review audio by row first, so audio_deleted_at tells the owner why it's gone.
  await step("delete_review_audio", async () => {
    const { data, error } = await db
      .from("reviews")
      .select("id, audio_path")
      .is("audio_deleted_at", null)
      .not("audio_path", "is", null)
      .lt("created_at", ago(now, RETENTION.reviewAudioDays * DAY_MS))
      .limit(BATCH);
    if (error) throw error;
    if (!data.length) return;
    result.reviewAudioDeleted = await remove("voice", data.map((r) => r.audio_path!));
    const { error: markError } = await db
      .from("reviews")
      .update({ audio_deleted_at: now.toISOString() })
      .in("id", data.map((r) => r.id));
    if (markError) throw markError;
  });

  await step("sweep_files", async () => {
    await sweepFiles(now, result);
  });

  return result;
}

// Every stored file by age: owner voice notes after 7 days, photos after 30,
// review audio after 30 (missed by the row step), uploads nothing uses after
// 24 hours, and files of shops that no longer exist (a delete-my-shop whose
// file removal failed) after 24 hours. Recent files are never touched, so a
// shop or upload created while this runs is safe.
async function sweepFiles(now: Date, result: CleanupResult) {
  const db = adminClient();
  const { data: shops, error } = await db.from("shops").select("id");
  if (error) throw error;
  const live = new Set(shops.map((s) => s.id));
  const age = (file: StoredFile) => now.getTime() - file.createdAt;
  const unusedAfter = RETENTION.unusedUploadHours * HOUR_MS;

  for (const bucket of ["voice", "photos", "catalog-images"] as const) {
    const { folders } = await listLevel(bucket, "");
    for (const shopFolder of folders) {
      if (!live.has(shopFolder)) {
        const stale = (await listAll(bucket, shopFolder)).filter((f) => age(f) > unusedAfter);
        result.leftoverFilesDeleted += await remove(bucket, stale.map((f) => f.path));
        continue;
      }
      // Product pictures stay while the shop does.
      if (bucket === "catalog-images") continue;

      const files = await listAll(bucket, shopFolder);
      if (!files.length) continue;
      const used = await usedPaths(shopFolder);
      const doomed: string[] = [];
      for (const file of files) {
        const kind = file.path.split("/")[1];
        const keepDays =
          bucket === "voice" && kind === "owner"
            ? RETENTION.ownerVoiceDays
            : bucket === "voice" && kind === "reviews"
              ? RETENTION.reviewAudioDays
              : bucket === "photos" && (kind === "bill" || kind === "shelf")
                ? RETENTION.photoDays
                : null;
        if (keepDays === null) continue;
        if (age(file) > keepDays * DAY_MS) {
          doomed.push(file.path);
          if (kind === "owner") result.ownerVoiceDeleted += 1;
          else if (kind === "reviews") result.reviewAudioDeleted += 1;
          else result.photosDeleted += 1;
        } else if (age(file) > unusedAfter && !used.has(file.path)) {
          doomed.push(file.path);
          result.unusedUploadsDeleted += 1;
        }
      }
      await remove(bucket, doomed);
    }
  }
}

// Paths a proposal or a review points at, for one shop.
async function usedPaths(shopId: string): Promise<Set<string>> {
  const db = adminClient();
  const [proposals, reviews] = await Promise.all([
    db.from("proposals").select("input_path").eq("shop_id", shopId).not("input_path", "is", null),
    db.from("reviews").select("audio_path").eq("shop_id", shopId).not("audio_path", "is", null),
  ]);
  if (proposals.error) throw proposals.error;
  if (reviews.error) throw reviews.error;
  return new Set([...proposals.data.map((p) => p.input_path!), ...reviews.data.map((r) => r.audio_path!)]);
}
