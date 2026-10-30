import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LangProvider } from "@/i18n/lang";
import { getStorefront } from "@/server/storefront";

import { StorefrontView } from "./storefront-view";

// P-1 Storefront (doc 06): the shop the way a painted signboard shows it,
// server-rendered from the cache and refreshed whenever the owner edits.
// Renders once the cached read is back, so customers never see a spinner
// (doc 06: server-rendered, no spinner). The root shell has already gone
// out by then, so a missing shop shows the not-found page with status 200
// and a noindex tag; a true 404 would need a database check in the proxy
// on every visit.
export const instant = false;

export default async function StorefrontPage({ params }: PageProps<"/s/[slug]">) {
  const shop = await getStorefront((await params).slug);
  if (!shop) notFound();
  return (
    <LangProvider initial={shop.language}>
      <StorefrontView shop={shop} />
    </LangProvider>
  );
}

export async function generateMetadata({ params }: PageProps<"/s/[slug]">): Promise<Metadata> {
  const shop = await getStorefront((await params).slug);
  if (!shop) return { title: "Shelf Voice" };
  return {
    title: shop.name,
    description: [shop.category, shop.address].filter(Boolean).join(" · ") || shop.description || undefined,
    openGraph: { title: shop.name, description: shop.description ?? shop.address ?? undefined, type: "website" },
  };
}
