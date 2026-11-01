import { Suspense } from "react";

import { Skeleton } from "@/components/ui/feedback";
import { LangProvider } from "@/i18n/lang";
import { requestLang } from "@/server/session";

import { Start } from "./start";

// The first screen (doc 06 O-1, changed by E-36): shop owner or customer.
// The language comes from the request, so the screen streams in behind a shell.
export default function Home() {
  return (
    <Suspense fallback={<SignInSkeleton />}>
      <Landing />
    </Suspense>
  );
}

async function Landing() {
  const lang = await requestLang();
  return (
    <LangProvider initial={lang}>
      <Start />
    </LangProvider>
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
