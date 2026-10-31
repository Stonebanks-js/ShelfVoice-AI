"use client";

import { Clock, ExternalLink, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Segmented } from "@/components/ui/controls";
import type { Lang } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";

import { ISSUES_URL, PRIVACY, UPDATED, type Kept } from "./content";

// Plain sections in the app's grouped-list style; the "how long" for each
// kind of data sits on its own line so long Hindi text never gets cut off.
export function PrivacyView() {
  const { lang, setLang, t } = useLang();
  const c = PRIVACY[lang];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="flex flex-col gap-4 px-4 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <Segmented<Lang>
          label={t("lang.label")}
          value={lang}
          onValueChange={setLang}
          className="w-44 self-end"
          options={[
            { value: "en", label: "English" },
            { value: "hi", label: <span lang="hi">हिन्दी</span> },
          ]}
        />
        <div>
          <h1 className="font-display text-large-title font-bold tracking-tight">{c.title}</h1>
          <p className="mt-1 text-footnote text-ink-2">
            <time dateTime={UPDATED}>{c.updated}</time>
          </p>
        </div>
        <p className="text-body">{c.intro}</p>
      </header>

      <Prose title={c.where.title} id="where">
        {c.where.body}
      </Prose>
      <KeptList title={c.owners.title} id="owners" rows={c.owners.rows} keepLabel={c.keepLabel} />
      <KeptList title={c.customers.title} id="customers" rows={c.customers.rows} keepLabel={c.keepLabel} />
      <Prose title={c.ai.title} id="ai">
        {c.ai.body}
      </Prose>

      <Section title={c.services.title} id="services">
        <ul>
          {c.services.rows.map((row) => (
            <li key={row.what} className="flex flex-col gap-0.5 border-separator px-4 py-3 [li+&]:border-t">
              <span className="text-body font-semibold">{row.what}</span>
              <span className="text-footnote text-ink-2">{row.detail}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Prose title={c.cookies.title} id="cookies">
        {c.cookies.body}
      </Prose>
      <Prose title={c.deleting.title} id="deleting">
        {c.deleting.body}
      </Prose>

      <Section title={c.contact.title} id="contact">
        <div className="flex flex-col gap-3 px-4 py-3">
          <p className="text-body">{c.contact.body}</p>
          <a
            href={ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 self-start text-body font-semibold text-accent underline-offset-4 hover:underline"
          >
            {c.contact.link}
            <ExternalLink aria-hidden className="size-4" />
          </a>
          <p className="flex items-start gap-2 text-footnote text-ink-2">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {c.contact.warning}
          </p>
        </div>
      </Section>
    </main>
  );
}

// A named region, so each part can be linked to (#customers) and found by
// screen-reader landmarks.
function Section({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex scroll-mt-4 flex-col gap-1.5">
      <h2 id={id} className="px-4 text-footnote font-medium text-ink-2">
        {title}
      </h2>
      <div className="overflow-hidden rounded-md bg-surface shadow-card">{children}</div>
    </section>
  );
}

function Prose({ title, id, children }: { title: string; id: string; children: string[] }) {
  return (
    <Section title={title} id={id}>
      <div className="flex flex-col gap-3 px-4 py-3">
        {children.map((paragraph) => (
          <p key={paragraph} className="text-body">
            {paragraph}
          </p>
        ))}
      </div>
    </Section>
  );
}

function KeptList({ title, id, rows, keepLabel }: { title: string; id: string; rows: Kept[]; keepLabel: string }) {
  return (
    <Section title={title} id={id}>
      <ul>
        {rows.map((row) => (
          <li key={row.what} className="flex flex-col gap-1 border-separator px-4 py-3 [li+&]:border-t">
            <span className="text-body font-semibold">{row.what}</span>
            <span className="text-footnote text-ink-2">{row.detail}</span>
            <span className="mt-0.5 flex items-center gap-1.5 text-footnote font-semibold text-ink">
              <Clock aria-hidden className="size-4 shrink-0 text-ink-2" />
              <span className="sr-only">{keepLabel}: </span>
              {row.keep}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
