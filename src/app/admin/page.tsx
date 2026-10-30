import { Bot, CircleAlert, Clock, MessageSquareText, Package, Store, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Badge } from "@/components/ui/controls";
import { EmptyState, PageHeader, Skeleton, SkeletonList } from "@/components/ui/feedback";
import { ListGroup, ListRow } from "@/components/ui/list";
import { adminToday, isAdminEmail, type AdminToday } from "@/server/admin";
import { ownerClient } from "@/server/supabase";

import { BreakerSwitch } from "./breaker-switch";

export const metadata: Metadata = { title: "Admin · Shelf Voice", robots: { index: false, follow: false } };

// A-1 admin (W-20b, F-12): today's spend against the budget, how each AI job
// is doing, how often owners confirm what the AI proposed, the counts, and
// the switch that pauses AI. Team only; the proxy 404s everyone else. In
// English, for the team.
export default function AdminPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Admin />
    </Suspense>
  );
}

function AdminLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-10">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-28 w-full rounded-lg" />
      <SkeletonList rows={4} label="Loading" />
    </div>
  );
}

const JOB_NAMES: Record<AdminToday["jobs"][number]["job"], string> = {
  SETUP_EXTRACTION: "Shop setup",
  COMMAND: "Voice command",
  BILL: "Bill photo",
  SHELF: "Shelf photo",
  REVIEW: "Customer review",
  EXPLANATION: "Restock reason",
  TRANSCRIBE: "Transcription",
  SEGMENT: "Shelf segmenting",
};

const usd = (value: number) => `$${value.toFixed(2)}`;
const percent = (part: number, whole: number) => (whole === 0 ? "–" : `${Math.round((part / whole) * 100)}%`);
const seconds = (ms: number | null) => (ms == null ? "–" : `${(ms / 1000).toFixed(1)} s`);

async function Admin() {
  // Belt and braces: the proxy already hid this page from non-admins.
  const { data } = await (await ownerClient()).auth.getUser();
  if (!isAdminEmail(data.user?.email)) notFound();
  const today = await adminToday();
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(now);
  const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(now);
  const used = Math.min(1, today.spentTotalUsd / today.budgetUsd);
  const tone = used >= 0.8 ? "bg-danger" : used >= 0.5 ? "bg-turmeric" : "bg-accent";

  return (
    <main lang="en" className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-10">
      <PageHeader title="Admin" subtitle={`Today in India · ${date}, ${time}`} />

      <section aria-labelledby="credit-title" className="mx-4 rounded-lg bg-surface p-4 shadow-card">
        <h2 id="credit-title" className="text-footnote font-semibold text-ink-2">
          Meta credit used
        </h2>
        <p className="mt-1 font-display text-figure font-bold tracking-tight tabular-nums">
          {usd(today.spentTotalUsd)} <span className="text-headline font-semibold text-ink-2">of {usd(today.budgetUsd)}</span>
        </p>
        <div
          role="meter"
          aria-label="Share of the AI budget used"
          aria-valuemin={0}
          aria-valuemax={today.budgetUsd}
          aria-valuenow={Number(today.spentTotalUsd.toFixed(2))}
          aria-valuetext={`${usd(today.spentTotalUsd)} of ${usd(today.budgetUsd)}`}
          className="mt-3 h-2 overflow-hidden rounded-full bg-fill"
        >
          <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(used * 100, used > 0 ? 2 : 0)}%` }} />
        </div>
        <p className="mt-3 text-footnote text-ink-2 tabular-nums">
          Today {usd(today.spentTodayUsd)} of the {usd(today.dailyBudgetUsd)} daily cap
        </p>
      </section>

      <BreakerSwitch initial={today.breaker} />

      <ListGroup header="AI today">
        {today.jobs.length === 0 ? (
          <div className="px-4 py-2">
            <EmptyState icon={<Bot />} title="No AI calls yet today" />
          </div>
        ) : (
          today.jobs.map((job) => (
            <ListRow
              key={job.job}
              icon={job.ok < job.calls ? <CircleAlert /> : <Bot />}
              iconTone={job.ok < job.calls ? "danger" : "accent"}
              title={JOB_NAMES[job.job]}
              subtitle={`${job.calls} ${job.calls === 1 ? "call" : "calls"} · ${usd(job.costUsd)} · p95 ${seconds(job.p95Ms)}`}
              value={<Badge tone={job.ok === job.calls ? "success" : job.ok / job.calls >= 0.9 ? "check" : "danger"}>{percent(job.ok, job.calls)} OK</Badge>}
            />
          ))
        )}
      </ListGroup>

      <ListGroup header="Owners today" footer="Confirmed with no card edited or removed, out of all confirmed today.">
        <ListRow
          icon={<UserRound />}
          iconTone="success"
          title="Confirmed as proposed"
          value={
            <span className="tabular-nums">
              {today.confirmedUnedited} of {today.confirmed} · {percent(today.confirmedUnedited, today.confirmed)}
            </span>
          }
        />
        <ListRow icon={<Clock />} iconTone="gray" title="Demo sign-ins" value={<span className="tabular-nums">{today.demoSignInsToday}</span>} />
      </ListGroup>

      <ListGroup header="Real shops" footer="Demo copies are left out.">
        <ListRow icon={<Store />} title="Shops" value={<span className="tabular-nums">{today.shops} · {today.shopsToday} new today</span>} />
        <ListRow icon={<Package />} title="Products" value={<span className="tabular-nums">{today.products}</span>} />
        <ListRow
          icon={<MessageSquareText />}
          title="Customer reviews"
          value={<span className="tabular-nums">{today.reviews} · {today.reviewsToday} today</span>}
        />
      </ListGroup>
    </main>
  );
}
