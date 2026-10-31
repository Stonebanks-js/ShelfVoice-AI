import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton, SkeletonList } from "@/components/ui/feedback";
import { LangProvider } from "@/i18n/lang";
import { requestLang } from "@/server/session";

import { PrivacyView } from "./privacy-view";

export const metadata: Metadata = {
  title: "Privacy · Shelf Voice",
  description: "What Shelf Voice keeps, where it is stored and when it is deleted.",
};

// F-14 privacy page (doc 03, errata E-28). Linked from the storefront, the
// review page, sign-in and My shop; `?lang=` carries the shop's language
// from those pages, otherwise the visitor's choice or phone language.
export default function PrivacyPage({ searchParams }: PageProps<"/privacy">) {
  return (
    <Suspense fallback={<PrivacySkeleton />}>
      <Privacy searchParams={searchParams} />
    </Suspense>
  );
}

async function Privacy({ searchParams }: Pick<PageProps<"/privacy">, "searchParams">) {
  const { lang: asked } = await searchParams;
  const lang = asked === "hi" || asked === "en" ? asked : await requestLang();
  return (
    <LangProvider initial={lang}>
      <PrivacyView />
    </LangProvider>
  );
}

function PrivacySkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-16">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-20 w-full" />
      <SkeletonList rows={4} label="Loading" />
    </main>
  );
}
