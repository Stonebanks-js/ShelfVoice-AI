import "server-only";

import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";

import { langFromAcceptLanguage, type Lang } from "@/i18n/dictionary";

import { ownerClient } from "./supabase";

export interface OwnerState {
  user: { id: string; isAnonymous: boolean };
  shop: { id: string; name: string; slug: string; language: Lang; isPublished: boolean; isDemo: boolean } | null;
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
  const { data: shop } = await db.from("shops").select("id, name, slug, language, is_published, is_demo").maybeSingle();
  return {
    user: { id: data.user.id, isAnonymous: data.user.is_anonymous ?? false },
    shop: shop
      ? {
          id: shop.id,
          name: shop.name,
          slug: shop.slug,
          language: shop.language === "en" ? "en" : "hi",
          isPublished: shop.is_published,
          isDemo: shop.is_demo,
        }
      : null,
  };
});

// Doc 06 U2: the owner's saved choice, else the cookie set by the language
// switch, else the phone's language.
export async function requestLang(state?: OwnerState | null): Promise<Lang> {
  if (state?.shop) return state.shop.language;
  const chosen = (await cookies()).get("sv_lang")?.value;
  if (chosen === "hi" || chosen === "en") return chosen;
  return langFromAcceptLanguage((await headers()).get("accept-language"));
}
