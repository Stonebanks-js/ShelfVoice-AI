import "server-only";

import { meta } from "@/server/ai";
import { type CatalogItem, extractSetup, interpretCommand, readBill } from "@/server/ai/jobs";
import { AiError } from "@/server/ai/meta";
import { AUDIO_LIMITS, checkWav } from "@/server/audio";
import { type Change, Changes, priceChangeAllowed } from "@/server/changes";
import { ApiError, fromPostgres } from "@/server/http";
import { log } from "@/server/log";
import type { Owner, Shop } from "@/server/owner";
import { adminClient } from "@/server/supabase";
import type { Json } from "@/types/database";

type Ctx = Owner & { shop: Shop; requestId: string };

// Plain JSON for the database: drops undefined fields, as the wire would.
const toJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as NonNullable<Json>;

export const UNDO_WINDOW_SECONDS = 60; // UI shows 10 s (doc 06); slack for slow networks (E-02)

export function aiFailure(error: unknown): never {
  if (error instanceof AiError) {
    if (error.code === "AI_PAUSED") throw new ApiError(503, "AI_PAUSED", "Voice is resting for now. You can still edit by tapping.");
    if (error.code === "AI_BAD_OUTPUT") throw new ApiError(422, "AI_NOT_UNDERSTOOD", "Couldn't understand that right now, your recording is saved");
    throw new ApiError(503, "AI_UNAVAILABLE", "Couldn't understand that right now, your recording is saved");
  }
  throw error;
}

export async function catalogFor({ db, shop }: Ctx): Promise<CatalogItem[]> {
  const { data, error } = await db
    .from("products")
    .select("id, name, aliases, price_paise, stock_qty")
    .eq("shop_id", shop.id)
    .is("archived_at", null)
    .order("name");
  if (error) throw fromPostgres(error);
  return data;
}

// ------------------------------------------------------------------ uploads
export type UploadKind = "voice" | "bill" | "shelf";

// A signed URL for one object under the owner's shop folder (doc 02:
// files skip the server; doc 03: scoped to one path, short-lived).
export async function signedUpload(ctx: Ctx, kind: UploadKind, clientId: string) {
  const bucket = kind === "voice" ? "voice" : "photos";
  const path = kind === "voice" ? `${ctx.shop.id}/owner/${clientId}.wav` : `${ctx.shop.id}/${kind}/${clientId}.jpg`;
  const { data, error } = await ctx.db.storage.from(bucket).createSignedUploadUrl(path, { upsert: true });
  if (error) throw new ApiError(500, "STORAGE", "Couldn't prepare the upload");
  return { bucket, path, signedUrl: data.signedUrl, token: data.token };
}

async function download(ctx: Ctx, bucket: "voice" | "photos", path: string, kind: string): Promise<Uint8Array> {
  // Only paths signedUpload() could have produced for this shop.
  const prefix = bucket === "voice" ? `${ctx.shop.id}/owner/` : `${ctx.shop.id}/${kind}/`;
  const fileName = path.startsWith(prefix) ? path.slice(prefix.length) : "";
  const pattern = bucket === "voice" ? /^[0-9a-f-]{36}\.wav$/ : /^[0-9a-f-]{36}\.jpg$/;
  if (!pattern.test(fileName)) throw new ApiError(422, "BAD_PATH", "That file isn't one of your uploads");
  const { data, error } = await ctx.db.storage.from(bucket).download(path);
  if (error || !data) throw new ApiError(404, "UPLOAD_MISSING", "The upload wasn't found; please try again");
  return new Uint8Array(await data.arrayBuffer());
}

async function existing(ctx: Ctx, inputPath: string) {
  const { data } = await ctx.db.from("proposals").select("*").eq("shop_id", ctx.shop.id).eq("input_path", inputPath).maybeSingle();
  return data;
}

async function store(ctx: Ctx, kind: "SETUP" | "COMMAND" | "BILL", inputPath: string, transcript: string | null, changes: Change[]) {
  const { data, error } = await ctx.db
    .from("proposals")
    .insert({ shop_id: ctx.shop.id, kind, input_path: inputPath, transcript, changes: toJson(Changes.parse(changes)) })
    .select("*")
    .single();
  if (error) {
    // Two requests for the same clip: return the one that won.
    if (error.code === "23505") return (await existing(ctx, inputPath))!;
    throw fromPostgres(error);
  }
  return data;
}

// ------------------------------------------------------------ voice proposal
export async function voiceProposal(ctx: Ctx, path: string, kind: "SETUP" | "COMMAND") {
  // Same clip again (retry, double tap): no second Meta call (doc 07).
  const prior = await existing(ctx, path);
  if (prior) return { proposal: prior, question: null, rejected: [] as string[] };

  const audio = await download(ctx, "voice", path, "owner");
  const wav = checkWav(audio, kind === "SETUP" ? AUDIO_LIMITS.setup : AUDIO_LIMITS.command);
  if (!wav.ok) throw new ApiError(422, "BAD_AUDIO", `The recording ${wav.reason}`);

  const catalog = await catalogFor(ctx);
  const ai = meta();
  const aiCtx = { job: "TRANSCRIBE" as const, shopId: ctx.shop.id, requestId: ctx.requestId };
  try {
    const keywords = [...new Set(catalog.flatMap((p) => [p.name, ...p.aliases]))];
    const { transcript } = await ai.transcribe(aiCtx, { audio, keywords });
    if (!transcript.trim()) throw new ApiError(422, "NOTHING_HEARD", "We didn't hear anything, try again");

    if (kind === "SETUP") {
      const changes = await extractSetup(ai, aiCtx, transcript);
      return { proposal: await store(ctx, "SETUP", path, transcript, changes), question: null, rejected: [] as string[] };
    }
    const result = await interpretCommand(ai, aiCtx, transcript, catalog, ctx.shop.language === "en" ? "en" : "hi");
    return { proposal: await store(ctx, "COMMAND", path, transcript, result.changes), question: result.question, rejected: result.rejected };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    aiFailure(error);
  }
}

// ------------------------------------------------------------- bill proposal
export async function billProposal(ctx: Ctx, path: string) {
  const prior = await existing(ctx, path);
  if (prior) return { proposal: prior };
  const image = await download(ctx, "photos", path, "bill");
  // Magic bytes: JPEG starts FF D8 FF (doc 03 upload checks).
  if (image.byteLength > 3 * 1024 * 1024 || image[0] !== 0xff || image[1] !== 0xd8 || image[2] !== 0xff) {
    throw new ApiError(422, "BAD_IMAGE", "The photo must be a JPEG under 3 MB");
  }
  const catalog = await catalogFor(ctx);
  try {
    const dataUrl = `data:image/jpeg;base64,${Buffer.from(image).toString("base64")}`;
    const changes = await readBill(meta(), { job: "BILL", shopId: ctx.shop.id, requestId: ctx.requestId }, dataUrl, catalog);
    return { proposal: await store(ctx, "BILL", path, null, changes) };
  } catch (error) {
    aiFailure(error);
  }
}

// ------------------------------------------------------------------- confirm
// The owner may edit or remove cards before confirming (doc 06 O-4), so the
// confirmed list comes from the request, validated again here and in SQL.
export async function confirmProposal(ctx: Ctx, proposalId: string, edited?: Change[]) {
  const { data: proposal } = await ctx.db.from("proposals").select("*").eq("id", proposalId).maybeSingle();
  if (!proposal) throw new ApiError(404, "PROPOSAL_NOT_FOUND", "Proposal not found");
  const changes = Changes.parse(edited ?? proposal.changes);

  // Doc 03: a new price must be above 0 and under 10x the old one.
  const priced = changes.filter((c): c is Extract<Change, { op: "update_price" }> => c.op === "update_price");
  if (priced.length && proposal.status === "PENDING") {
    const { data: rows } = await ctx.db.from("products").select("id, price_paise").in("id", priced.map((c) => c.product_id));
    for (const change of priced) {
      const old = rows?.find((r) => r.id === change.product_id)?.price_paise ?? null;
      if (!priceChangeAllowed(old, change.price_paise)) throw new ApiError(422, "PRICE_OUT_OF_RANGE", "That price looks wrong, please check it");
    }
  }

  const { data, error } = await ctx.db.rpc("confirm_proposal", { p_proposal_id: proposalId, p_changes: toJson(changes) });
  if (error) throw fromPostgres(error);

  // For the admin page's confirm-unedited rate (W-20b). Only the first
  // confirm counts; a repeat of the same request changes nothing.
  if (proposal.status === "PENDING") {
    const ownerEdited = JSON.stringify(changes) !== JSON.stringify(Changes.parse(proposal.changes));
    const { error: markError } = await adminClient().from("proposals").update({ owner_edited: ownerEdited }).eq("id", proposalId).is("owner_edited", null);
    if (markError) log("warn", "proposal.mark_edited_failed", { requestId: ctx.requestId, proposalId, error: markError.message });
  }
  return data as Array<{ op: string; product_id?: string }>;
}

// ---------------------------------------------------------------------- undo
export async function undoProposal(ctx: Ctx, proposalId: string) {
  // Ownership through RLS first; the undo itself runs as the server (E-02).
  const { data: proposal } = await ctx.db.from("proposals").select("id").eq("id", proposalId).maybeSingle();
  if (!proposal) throw new ApiError(404, "PROPOSAL_NOT_FOUND", "Proposal not found");
  const { data, error } = await adminClient().rpc("undo_proposal", {
    p_proposal_id: proposalId,
    p_window_seconds: UNDO_WINDOW_SECONDS,
  });
  if (error) throw fromPostgres(error);
  return data as Array<{ op: string; product_id?: string; undo: string }>;
}

export const touchedProducts = (changes: Array<{ product_id?: string }>) =>
  [...new Set(changes.map((c) => c.product_id).filter((id): id is string => Boolean(id)))];
