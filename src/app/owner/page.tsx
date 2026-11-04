import { Suspense } from "react";

import { Skeleton } from "@/components/ui/feedback";
import { LangRoot } from "@/i18n/lang-root";
import { requestLang } from "@/server/session";

import { OwnerSignIn } from "./owner-sign-in";

// Sign in for shop owners: Continue with Google, which
// also creates the account. The language comes from the request.
export default function OwnerPage({ searchParams }: PageProps<"/owner">) {
  return (
    <Suspense fallback={<SignInSkeleton />}>
      <Owner searchParams={searchParams} />
    </Suspense>
  );
}

async function Owner({ searchParams }: Pick<PageProps<"/owner">, "searchParams">) {
  const [lang, params] = await Promise.all([requestLang(), searchParams]);
  return (
    <LangRoot initial={lang}>
      <OwnerSignIn failed={params.signin === "failed"} />
    </LangRoot>
  );
}

function SignInSkeleton() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-6 pt-20">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-5 w-64" />
    </main>
  );
}
