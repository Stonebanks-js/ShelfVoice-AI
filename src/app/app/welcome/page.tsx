import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ownerState, requestLang } from "@/server/session";

import Loading from "../loading";
import { LanguageChoice } from "./language-choice";

// O-2 Language (doc 06): the first-run choice, preselected from the phone.
// Only for a new owner with no shop yet; demo users arrive with one.
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
  return <LanguageChoice initial={await requestLang(state)} />;
}
