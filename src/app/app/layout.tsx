import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ClipQueueProvider } from "@/components/shell/clip-queue";
import { ToastProvider } from "@/components/ui/toast";
import { LangProvider } from "@/i18n/lang";
import { ownerState, requestLang } from "@/server/session";

import Loading from "./loading";
import { OwnerTabBar } from "./owner-tab-bar";

// The owner app shell (doc 06 U3): every screen in the owner's language, the
// tab bar once a shop exists. Per-user, so it streams in behind a skeleton.
export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <Suspense fallback={<Loading />}>
      <AppFrame>{children}</AppFrame>
    </Suspense>
  );
}

async function AppFrame({ children }: { children: React.ReactNode }) {
  const state = await ownerState();
  if (!state) redirect("/");
  const lang = await requestLang(state);
  return (
    <LangProvider initial={lang}>
      <ToastProvider>
        <ClipQueueProvider ownerId={state.user.id}>
          <div className="flex min-h-dvh flex-col pb-[calc(env(safe-area-inset-bottom)+6rem)]">{children}</div>
          {state.shop && <OwnerTabBar />}
        </ClipQueueProvider>
      </ToastProvider>
    </LangProvider>
  );
}
