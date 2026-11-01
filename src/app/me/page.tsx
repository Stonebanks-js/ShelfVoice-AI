import type { Metadata } from "next";
import { Suspense } from "react";

import { ToastProvider } from "@/components/ui/toast";
import { LangProvider } from "@/i18n/lang";
import { getAccount } from "@/server/customer";
import { safeNext } from "@/server/next-path";
import { currentUser } from "@/server/owner";
import { requestLang } from "@/server/session";

import { AccountScreen, SignInToAccount } from "./account-screen";

export const metadata: Metadata = { title: "Account · Shelf Voice", robots: { index: false, follow: false } };

// A customer's Account (V-05, E-36): sign in with Google, then details,
// saved addresses, how they pay, past orders, refunds, wishlist and
// favourite shops. `?next=` brings them back to the shop they came from.
export default function MePage({ searchParams }: PageProps<"/me">) {
  return (
    <Suspense>
      <Me searchParams={searchParams} />
    </Suspense>
  );
}

async function Me({ searchParams }: Pick<PageProps<"/me">, "searchParams">) {
  const [user, query, lang] = await Promise.all([currentUser(), searchParams, requestLang()]);
  const next = typeof query.next === "string" ? safeNext(query.next) : "/me";
  return (
    <LangProvider initial={lang}>
      <ToastProvider>{user ? <AccountScreen account={await getAccount(user)} /> : <SignInToAccount next={next === "/app" ? "/me" : next} />}</ToastProvider>
    </LangProvider>
  );
}
