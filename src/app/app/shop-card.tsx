"use client";

import { Eye, EyeOff, ExternalLink, ListPlus, Pencil, Share } from "lucide-react";
import Link from "next/link";

import { buttonClass, Button, ButtonLink } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useLang } from "@/i18n/lang";
import { cn } from "@/lib/cn";

// The owner's shop at the top of Home (V-02, E-36): owners asked where to
// build the shop and where to see it, so both are the first thing on screen.
// An empty shop gets one big Build button instead.
export function ShopCard({ name, slug, published, productCount }: { name: string; slug: string; published: boolean; productCount: number }) {
  const { t } = useLang();
  const toast = useToast();
  const path = `/s/${slug}`;

  async function share() {
    const url = `${window.location.origin}${path}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: name, url });
        return;
      } catch (error) {
        // The owner closed the share sheet: do nothing more.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.show({ message: t("shop.linkCopied") });
    } catch {
      window.prompt(t("shop.shareLink"), url);
    }
  }

  return (
    <section aria-labelledby="home-shop" className="mx-4 flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card">
      <div className="flex flex-col gap-1">
        <h2 id="home-shop" className="font-display text-title font-bold tracking-tight">
          <Link href="/app/shop" className="underline-offset-4 hover:underline">
            {name}
          </Link>
        </h2>
        <p className={cn("flex flex-wrap items-center gap-1.5 text-footnote font-medium", published ? "text-ink" : "text-danger")}>
          {published ? <Eye aria-hidden className="size-4" /> : <EyeOff aria-hidden className="size-4" />}
          {t(published ? "home.live" : "home.hidden")}
          {productCount > 0 && <span className="font-normal text-ink-2">· {t("home.products", { n: productCount })}</span>}
        </p>
      </div>
      {productCount === 0 ? (
        <>
          <p className="text-body text-ink-2">{t("today.setup.body")}</p>
          <ButtonLink href="/app/setup" size="lg" icon={<ListPlus aria-hidden className="size-5" />}>
            {t("home.build")}
          </ButtonLink>
        </>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <a href={path} target="_blank" rel="noopener" className={buttonClass("tinted", "md", "px-2")}>
            <ExternalLink aria-hidden className="size-5 shrink-0" />
            {t("home.view")}
          </a>
          <Button variant="tinted" className="px-2" icon={<Share aria-hidden className="size-5 shrink-0" />} onClick={share}>
            {t("home.share")}
          </Button>
          <ButtonLink href="/app/shop" variant="tinted" className="px-2" icon={<Pencil aria-hidden className="size-5 shrink-0" />}>
            {t("home.edit")}
          </ButtonLink>
        </div>
      )}
    </section>
  );
}
