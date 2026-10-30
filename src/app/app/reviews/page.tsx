import { redirect } from "next/navigation";
import { Suspense } from "react";

import { reviewFeed } from "@/server/reviews";
import { ownerState } from "@/server/session";
import { ownerClient } from "@/server/supabase";

import Loading from "../loading";
import { ReviewsScreen } from "./reviews-screen";

const PAGE_SIZE = 20;

// O-8 Reviews (doc 06): the customers' voice feed with sentiment, what they
// said, the items they mentioned, the recording for 30 days, and Hide.
export default function ReviewsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Reviews />
    </Suspense>
  );
}

async function Reviews() {
  const state = await ownerState();
  if (!state) redirect("/");
  if (!state.shop) redirect("/app/welcome");
  const db = await ownerClient();
  const [reviews, { data: products, error }] = await Promise.all([
    reviewFeed(db, state.shop.id, 1, PAGE_SIZE),
    db.from("products").select("id, name").eq("shop_id", state.shop.id),
  ]);
  if (error) throw error;
  return <ReviewsScreen initial={reviews} pageSize={PAGE_SIZE} productNames={Object.fromEntries((products ?? []).map((p) => [p.id, p.name]))} />;
}
