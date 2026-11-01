import "server-only";

import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";

import { isLang, type Lang, langFromAcceptLanguage, langFromRegion, translate } from "@/i18n/dictionary";

import "@/i18n/server"; // regional text for server-rendered pages (V-06)

import { ownerClient } from "./supabase";

export interface OwnerState {
  user: { id: string; isAnonymous: boolean };
  shop: { id: string; name: string; slug: string; category: string | null; language: Lang; isPublished: boolean } | null;
}

// The signed-in owner and their shop, read once per request for pages. Null
// when signed out (the proxy also redirects those requests).
export const ownerState = cache(async (): Promise<OwnerState | null> => {
  // Per request: the Supabase client reads the clock as it starts, which
  // Next would otherwise flag while prerendering the page shell.
  await connection();
  const db = await ownerClient();
  const { data } = await db.auth.getUser();
  if (!data.user) return null;
  const { data: shop } = await db.from("shops").select("id, name, slug, category, language, is_published").maybeSingle();
  return {
    user: { id: data.user.id, isAnonymous: data.user.is_anonymous ?? false },
    shop: shop
      ? {
          id: shop.id,
          name: shop.name,
          slug: shop.slug,
          category: shop.category,
          language: isLang(shop.language) ? shop.language : "hi",
          isPublished: shop.is_published,
        }
      : null,
  };
});

// "You seem to be in Karnataka" (V-06): the language of the state the
// visitor's internet address is in (Vercel sets these headers), unless they
// already chose one, or it's the one they have.
export async function languageSuggestion(current: Lang): Promise<{ state: string; lang: Lang; question: string } | null> {
  if (isLang((await cookies()).get("sv_lang")?.value)) return null;
  const h = await headers();
  const found = langFromRegion(h.get("x-vercel-ip-country"), h.get("x-vercel-ip-country-region"));
  if (!found || found.lang === current) return null;
  return { ...found, question: translate(found.lang, "lang.suggest", { state: found.state }) };
}

// Doc 06 U2: the owner's saved choice, else the cookie set by the language
// switch, else the phone's language.
export async function requestLang(state?: OwnerState | null): Promise<Lang> {
  if (state?.shop) return state.shop.language;
  const chosen = (await cookies()).get("sv_lang")?.value;
  if (isLang(chosen)) return chosen;
  return langFromAcceptLanguage((await headers()).get("accept-language"));
}
