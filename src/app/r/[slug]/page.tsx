import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LangRoot } from "@/i18n/lang-root";
import { customerLang } from "@/server/session";
import { getStorefront } from "@/server/storefront";

import { ReviewFlow } from "./review-flow";

// P-2 Leave a voice review (doc 06): shop name, consent, a 15-second mic,
// thank you. No name, phone or stars; the voice is the whole review.
// Renders once the cached read is back, so customers never see a spinner
// (doc 06: server-rendered, no spinner). The root shell has already gone
// out by then, so a missing shop shows the not-found page with status 200
// and a noindex tag; a true 404 would need a database check in the proxy
// on every visit.
export const instant = false;

export default async function ReviewPage({ params }: PageProps<"/r/[slug]">) {
  const shop = await getStorefront((await params).slug);
  if (!shop) notFound();
  return (
    <LangRoot initial={await customerLang(shop.language)}>
      <ReviewFlow slug={shop.slug} shopName={shop.name} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} />
    </LangRoot>
  );
}

export async function generateMetadata({ params }: PageProps<"/r/[slug]">): Promise<Metadata> {
  const shop = await getStorefront((await params).slug);
  return { title: shop ? `Review · ${shop.name}` : "Shelf Voice", robots: { index: false } };
}
