import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ClipQueueProvider } from "@/components/shell/clip-queue";
import { ToastProvider } from "@/components/ui/toast";
import { LangRoot } from "@/i18n/lang-root";
import { ownerState, requestLang } from "@/server/session";

import Loading from "./loading";
import { OwnerMain, OwnerTabBar } from "./owner-tab-bar";

// The owner app shell (doc 06 U3): every screen in the owner's language, the
// tab bar (a sidebar on desktop, E-37) once a shop exists. Per-user, so it streams in behind a skeleton.
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
    <LangRoot initial={lang}>
      <ToastProvider>
        <ClipQueueProvider ownerId={state.user.id}>
          <OwnerMain withBar={Boolean(state.shop)}>{children}</OwnerMain>
          {state.shop && <OwnerTabBar shop={{ name: state.shop.name, slug: state.shop.slug }} />}
        </ClipQueueProvider>
      </ToastProvider>
    </LangRoot>
  );
}
