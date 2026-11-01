import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ownerState } from "@/server/session";

import { AddHub } from "../add/add-hub";
import Loading from "../loading";

// O-3 first run (doc 06, changed by E-36): choose how to add products. Voice
// setup is one of the ways, at /app/setup/voice.
export default function SetupPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Setup />
    </Suspense>
  );
}

async function Setup() {
  const state = await ownerState();
  if (!state) redirect("/");
  if (!state.shop) redirect("/app/welcome");
  return <AddHub firstRun />;
}
