"use client";

import { CircleAlert, EyeOff, Eye, Frown, Hourglass, Meh, MessageSquareText, MicOff, Pause, Play, QrCode, Smile } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, Chip } from "@/components/ui/controls";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { IconTile, type IconTone } from "@/components/ui/list";
import { useToast } from "@/components/ui/toast";
import type { Lang, MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { errorKey } from "@/lib/errors";
import type { FeedReview } from "@/server/reviews";

type Filter = "all" | "unhappy" | "hidden";

const LOOK: Record<string, { icon: ReactNode; tone: IconTone; word: MessageKey }> = {
  POSITIVE: { icon: <Smile />, tone: "success", word: "sentiment.POSITIVE" },
  NEUTRAL: { icon: <Meh />, tone: "accent", word: "sentiment.NEUTRAL" },
  NEGATIVE: { icon: <Frown />, tone: "danger", word: "sentiment.NEGATIVE" },
  PENDING: { icon: <Hourglass />, tone: "gray", word: "reviews.pending" },
  FAILED: { icon: <MessageSquareText />, tone: "gray", word: "reviews.failed" },
  SILENT: { icon: <MicOff />, tone: "gray", word: "reviews.silent" },
};

export function ReviewsScreen({
  initial,
  pageSize,
  productNames,
}: {
  initial: FeedReview[];
  pageSize: number;
  productNames: Record<string, string>;
}) {
  const { t } = useLang();
  const toast = useToast();
  const [reviews, setReviews] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(initial.length === pageSize);
  const [loadingMore, setLoadingMore] = useState(false);

  const shown = reviews.filter((r) =>
    filter === "hidden" ? r.is_hidden : filter === "unhappy" ? r.sentiment === "NEGATIVE" && !r.is_hidden : !r.is_hidden,
  );

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = await api<{ reviews: FeedReview[] }>(`/api/v1/reviews?page=${page + 1}&pageSize=${pageSize}`);
      setReviews((list) => [...list, ...next.reviews]);
      setPage(page + 1);
      setMore(next.reviews.length === pageSize);
    } catch (failure) {
      toast.show({ message: t(errorKey(failure)) });
    } finally {
      setLoadingMore(false);
    }
  }

  // Doc 03: owners can hide a review from the shop page, never edit it.
  async function setHidden(review: FeedReview, hidden: boolean) {
    setReviews((list) => list.map((r) => (r.id === review.id ? { ...r, is_hidden: hidden } : r)));
    try {
      await api(`/api/v1/reviews/${review.id}`, { method: "PATCH", json: { is_hidden: hidden } });
      toast.show({ message: t(hidden ? "reviews.hiddenToast" : "reviews.shownToast") });
    } catch (failure) {
      setReviews((list) => list.map((r) => (r.id === review.id ? { ...r, is_hidden: !hidden } : r)));
      toast.show({ message: t(errorKey(failure)) });
    }
  }

  if (reviews.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <PageHeader title={t("tab.reviews")} />
        <div className="px-4">
          <EmptyState
            icon={<MessageSquareText />}
            title={t("reviews.empty.title")}
            body={t("reviews.empty.body")}
            action={
              <ButtonLink href="/app/shop" size="lg" icon={<QrCode aria-hidden className="size-5" />}>
                {t("reviews.empty.cta")}
              </ButtonLink>
            }
          />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-4">
      <PageHeader title={t("tab.reviews")} subtitle={more ? undefined : t("reviews.count", { n: reviews.length })} />
      <div className="-mx-0 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]">
        {(
          [
            ["all", "stock.all"],
            ["unhappy", "sentiment.NEGATIVE"],
            ["hidden", "reviews.hiddenFilter"],
          ] as const
        ).map(([value, label]) => (
          <Chip key={value} selected={filter === value} onClick={() => setFilter(value)}>
            {t(label)}
          </Chip>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="px-8 py-6 text-center text-body text-ink-2">{t("reviews.none")}</p>
      ) : (
        <ul className="flex flex-col gap-3 px-4">
          {shown.map((review) => (
            <ReviewCard key={review.id} review={review} productNames={productNames} onHidden={(hidden) => setHidden(review, hidden)} />
          ))}
        </ul>
      )}

      {more && (
        <div className="px-4">
          <Button variant="gray" loading={loadingMore} onClick={loadMore} className="w-full">
            {t("reviews.more")}
          </Button>
        </div>
      )}
    </main>
  );
}

function ago(iso: string, lang: Lang): string {
  const when = new Intl.RelativeTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", { numeric: "auto" });
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return when.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  return Math.abs(hours) < 24 ? when.format(hours, "hour") : when.format(Math.round(hours / 24), "day");
}

// Doc 06 ReviewCard: sentiment icon and word, transcript, item chips, play
// button (hidden after 30 days), hide.
function ReviewCard({
  review,
  productNames,
  onHidden,
}: {
  review: FeedReview;
  productNames: Record<string, string>;
  onHidden: (hidden: boolean) => void;
}) {
  const { lang, t } = useLang();
  // A recording with no speech is analysed but has nothing to say.
  const silent = review.status === "ANALYZED" && !review.transcript?.trim();
  const look = LOOK[silent ? "SILENT" : review.status === "ANALYZED" ? (review.sentiment ?? "NEUTRAL") : review.status];
  const stockouts = new Set(review.stockout_product_ids);
  const items = review.mentioned_product_ids.filter((id) => productNames[id]);
  return (
    <li className={cn("flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card", review.is_hidden && "border border-dashed border-separator")}>
      <div className="flex items-center gap-3">
        <IconTile icon={look.icon} tone={look.tone} />
        <p className="flex-1 text-footnote font-semibold">
          {t(look.word)}{" "}
          {/* Relative time can tick over between server render and hydration. */}
          <span className="font-normal text-ink-2" suppressHydrationWarning>
            · {ago(review.created_at, lang)}
          </span>
        </p>
        <Button
          variant="plain"
          icon={review.is_hidden ? <Eye aria-hidden className="size-5" /> : <EyeOff aria-hidden className="size-5" />}
          onClick={() => onHidden(!review.is_hidden)}
          className="-mr-2"
        >
          {t(review.is_hidden ? "reviews.show" : "reviews.hide")}
        </Button>
      </div>

      {review.summary && !silent && <p className="text-headline font-semibold">{review.summary}</p>}
      {review.transcript && (
        <blockquote className="border-l-3 border-separator pl-3 text-body text-ink-2">“{review.transcript}”</blockquote>
      )}

      {items.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={t("reviews.items")}>
          {items.map((id) =>
            stockouts.has(id) ? (
              <li key={id}>
                <Badge tone="danger" icon={<CircleAlert aria-hidden />}>
                  {t("reviews.wantedOut", { name: productNames[id] })}
                </Badge>
              </li>
            ) : (
              <li key={id}>
                <Badge>{productNames[id]}</Badge>
              </li>
            ),
          )}
        </ul>
      )}

      {review.audioUrl ? (
        <AudioButton src={review.audioUrl} />
      ) : review.audioRemoved ? (
        <p className="text-footnote text-ink-2">{t("reviews.audioRemoved")}</p>
      ) : null}

      {review.is_hidden && (
        <p className="flex items-center gap-1.5 text-footnote text-ink-2">
          <EyeOff aria-hidden className="size-4" />
          {t("reviews.hiddenNote")}
        </p>
      )}
    </li>
  );
}

// One button that plays and pauses the customer's 15-second recording.
function AudioButton({ src }: { src: string }) {
  const { t } = useLang();
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  return (
    <div>
      <Button
        variant="tinted"
        icon={playing ? <Pause aria-hidden className="size-5" /> : <Play aria-hidden className="size-5" />}
        onClick={() => {
          const el = audio.current;
          if (!el) return;
          if (el.paused) void el.play();
          else el.pause();
        }}
      >
        {t(playing ? "reviews.pause" : "reviews.play")}
      </Button>
      <audio ref={audio} src={src} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
    </div>
  );
}
