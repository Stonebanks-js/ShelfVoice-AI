import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { Changes } from "@/server/changes";
import { ownerState } from "@/server/session";
import { ownerClient } from "@/server/supabase";

import Loading from "../../loading";
import { CheckScreen } from "./check-screen";

// O-4 Check and confirm (doc 06): every voice or photo action lands here
// before anything is saved.
export default function CheckPage({ params }: PageProps<"/app/check/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Check params={params} />
    </Suspense>
  );
}

async function Check({ params }: Pick<PageProps<"/app/check/[id]">, "params">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const state = await ownerState();
  if (!state) redirect("/");
  if (!state.shop) redirect("/app/welcome");

  const db = await ownerClient();
  const [{ data: proposal }, { data: products }] = await Promise.all([
    db.from("proposals").select("id, kind, status, transcript, changes").eq("id", id).maybeSingle(),
    db.from("products").select("id, name, price_paise").eq("shop_id", state.shop.id).is("archived_at", null),
  ]);
  if (!proposal) notFound();
  // Stored changes were validated on the way in; parse again so the screen
  // only ever renders the known shapes.
  const changes = Changes.safeParse(proposal.changes);

  return (
    <CheckScreen
      proposal={{
        id: proposal.id,
        kind: proposal.kind,
        status: proposal.status,
        transcript: proposal.transcript,
        changes: changes.success ? changes.data : [],
      }}
      catalog={products ?? []}
    />
  );
}
