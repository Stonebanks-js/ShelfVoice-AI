import "server-only";

import { log } from "./log";
import { adminClient } from "./supabase";

const BUCKETS = ["voice", "photos", "catalog-images"] as const;

// Every object under a folder, however deep (Storage lists one level at a time).
async function listAll(bucket: string, prefix: string): Promise<string[]> {
  const storage = adminClient().storage.from(bucket);
  const paths: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await storage.list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const entry of data) {
      const path = `${prefix}/${entry.name}`;
      // Folders come back without an id.
      if (entry.id === null) paths.push(...(await listAll(bucket, path)));
      else paths.push(path);
    }
    if (data.length < 1000) return paths;
  }
}

async function removeFiles(shopId: string) {
  for (const bucket of BUCKETS) {
    const paths = await listAll(bucket, shopId);
    for (let i = 0; i < paths.length; i += 500) {
      const { error } = await adminClient().storage.from(bucket).remove(paths.slice(i, i + 500));
      if (error) throw error;
    }
  }
}

// Delete my shop (doc 01 FR-16, doc 03): the shop row and everything that
// cascades from it, every stored file, then the account. Files are removed
// first and retried once; the nightly job sweeps anything left (W-17b).
export async function deleteShop({ shopId, userId, requestId }: { shopId: string; userId: string; requestId: string }) {
  try {
    await removeFiles(shopId);
  } catch (error) {
    log("warn", "shop.delete.files_retry", { requestId, shopId, error });
    try {
      await removeFiles(shopId);
    } catch (retryError) {
      log("error", "shop.delete.files_failed", { requestId, shopId, error: retryError });
    }
  }
  const db = adminClient();
  const { error: shopError } = await db.from("shops").delete().eq("id", shopId);
  if (shopError) throw shopError;
  const { error: userError } = await db.auth.admin.deleteUser(userId);
  if (userError) throw userError;
  log("info", "shop.deleted", { requestId, shopId });
}
