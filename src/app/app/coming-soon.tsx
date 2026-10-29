import { Hammer } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { translate, type MessageKey } from "@/i18n/dictionary";
import { ownerState, requestLang } from "@/server/session";

import Loading from "./loading";

// Holds a tab's place until its screen is built (F-05 to F-08), so the tab
// bar never leads to a 404. The session read streams behind the page's own
// boundary, so a tab tap shows the skeleton at once.
export function ComingSoon({ title }: { title: MessageKey }) {
  return (
    <Suspense fallback={<Loading />}>
      <ComingSoonBody title={title} />
    </Suspense>
  );
}

async function ComingSoonBody({ title }: { title: MessageKey }) {
  const state = await ownerState();
  if (!state) redirect("/");
  if (!state.shop) redirect("/app/welcome");
  const lang = await requestLang(state);
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader title={translate(lang, title)} subtitle={state.shop.name} />
      <div className="px-4">
        <EmptyState icon={<Hammer />} title={translate(lang, "soon.title")} body={translate(lang, "soon.body")} />
      </div>
    </main>
  );
}
