import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ownerState } from "@/server/session";

import Loading from "../loading";
import { SetupScreen } from "./setup-screen";

// O-3 Tell us about your shop (doc 06): first-run voice setup, up to two
// minutes, ending in Check and confirm.
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
  return <SetupScreen />;
}
