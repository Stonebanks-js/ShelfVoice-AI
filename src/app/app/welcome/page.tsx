import { redirect } from "next/navigation";
import { Suspense } from "react";

import { languageSuggestion, ownerState, requestLang } from "@/server/session";

import Loading from "../loading";
import { SetupSteps } from "./setup-steps";

// O-2 setup (doc 06, E-36): language, shop name, kind and place, for a new
// owner with no shop yet. The language is preselected from the phone.
export default function WelcomePage() {
  return (
    <Suspense fallback={<Loading />}>
      <Welcome />
    </Suspense>
  );
}

async function Welcome() {
  const state = await ownerState();
  if (!state) redirect("/");
  if (state.shop) redirect("/app");
  // The state's language is suggested above the list (V-06); the owner picks.
  const lang = await requestLang(state);
  return <SetupSteps initial={lang} suggestion={await languageSuggestion(lang)} />;
}
