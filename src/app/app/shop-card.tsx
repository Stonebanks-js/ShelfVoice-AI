"use client";

import { Eye, EyeOff, ExternalLink, ListPlus, Pencil, Share } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useLang } from "@/i18n/lang";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { errorKey } from "@/lib/errors";

// The owner's shop at the top of Home (V-02, E-36): owners asked where to
// build the shop and where to see it, so both are the first thing on screen.
// An empty shop gets one big Build button instead; a hidden one with
// products gets the button that shows it to customers (V-03).
export function ShopCard({
  id,
  name,
  slug,
  published,
  productCount,
}: {
  id: string;
  name: string;
  slug: string;
  published: boolean;
  productCount: number;
}) {
  const { t } = useLang();
  const toast = useToast();
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const path = `/s/${slug}`;

  async function publish() {
    setPublishing(true);
    try {
      await api(`/api/v1/shops/${id}/publish`, { json: { published: true } });
      toast.show({ message: t("home.publishedNow") });
      router.refresh();
    } catch (failure) {
      toast.show({ message: t(errorKey(failure)) });
    } finally {
      setPublishing(false);
    }
  }

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
    <section aria-labelledby="home-shop" className="mx-4 flex flex-col gap-4 rounded-xl bg-surface p-4 shadow-card">
      <div className="flex items-center gap-3">
        {/* The shop's monogram, in the brand's tint (E-37). */}
        <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-lg bg-accent-soft font-display text-title font-bold text-accent-fill">
          {name.trim().charAt(0).toUpperCase()}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="home-shop" className="font-display text-headline leading-tight font-bold tracking-tight">
            <Link href="/app/shop" className="underline-offset-4 hover:underline">
              {name}
            </Link>
          </h2>
          <p className="flex flex-wrap items-center gap-1.5 text-footnote">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
                published ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
              )}
            >
              {published ? <Eye aria-hidden className="size-3.5" /> : <EyeOff aria-hidden className="size-3.5" />}
              {t(published ? "home.live" : "home.hidden")}
            </span>
            {productCount > 0 && <span className="text-ink-2">· {t("home.products", { n: productCount })}</span>}
          </p>
        </div>
      </div>
      {productCount === 0 ? (
        <>
          <p className="text-body text-ink-2">{t("today.setup.body")}</p>
          <ButtonLink href="/app/setup" size="lg" icon={<ListPlus aria-hidden className="size-5" />}>
            {t("home.build")}
          </ButtonLink>
        </>
      ) : (
        <>
          {!published && (
            <Button size="lg" loading={publishing} icon={<Eye aria-hidden className="size-5" />} onClick={publish}>
              {t("home.publish")}
            </Button>
          )}
          {/* Round action tiles, as in the big consumer apps (E-37). */}
          <div className="grid grid-cols-3 gap-2">
            <a href={path} target="_blank" rel="noopener" className={TILE}>
              <span className={TILE_ICON}>
                <ExternalLink aria-hidden />
              </span>
              {t("home.view")}
            </a>
            <button type="button" className={TILE} onClick={share}>
              <span className={TILE_ICON}>
                <Share aria-hidden />
              </span>
              {t("home.share")}
            </button>
            <Link href="/app/shop" className={TILE}>
              <span className={TILE_ICON}>
                <Pencil aria-hidden />
              </span>
              {t("home.edit")}
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

const TILE =
  "flex min-h-12 flex-col items-center gap-1.5 rounded-lg py-2 text-footnote font-semibold text-ink transition-[background-color,transform] active:scale-95 [@media(hover:hover)]:hover:bg-fill/60";
const TILE_ICON = "grid size-12 place-items-center rounded-full bg-surface-2 text-ink ring-1 ring-separator [&>svg]:size-5";
