import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/feedback";
import { LangRoot } from "@/i18n/lang-root";
import { languageSuggestion, ownerState, requestLang } from "@/server/session";

import { Start } from "./start";

// The first screen: shop owner or customer.
// The language comes from the request, so the screen streams in behind a shell.
export default function Home() {
  return (
    <Suspense fallback={<SignInSkeleton />}>
      <Landing />
    </Suspense>
  );
}

async function Landing() {
  // A signed-in shop owner goes straight to their shop; a customer stays.
  const state = await ownerState();
  if (state?.shop) redirect("/app");
  const lang = await requestLang(state);
  const suggestion = await languageSuggestion(lang);
  return (
    <LangRoot initial={lang}>
      <Start suggestion={suggestion} />
    </LangRoot>
  );
}

function SignInSkeleton() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-6 pt-20">
      <Skeleton className="size-20 rounded-[1.375rem]" />
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-5 w-64" />
    </main>
  );
}
