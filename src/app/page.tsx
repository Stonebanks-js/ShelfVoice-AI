import { Suspense } from "react";

import { Skeleton } from "@/components/ui/feedback";
import { LangProvider } from "@/i18n/lang";
import { requestLang } from "@/server/session";

import { SignIn } from "./sign-in";

// O-1 Sign in (doc 06): get in fast with Google or the demo shop. The
// language comes from the request, so the screen streams in behind a shell.
export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<SignInSkeleton />}>
      <Landing searchParams={searchParams} />
    </Suspense>
  );
}

async function Landing({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const [lang, params] = await Promise.all([requestLang(), searchParams]);
  return (
    <LangProvider initial={lang}>
      <SignIn failed={params.signin === "failed"} />
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
