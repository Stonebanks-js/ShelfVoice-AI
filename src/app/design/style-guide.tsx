"use client";

import {
  Camera,
  CircleAlert,
  CircleCheck,
  Inbox,
  Mic,
  Package,
  PackageX,
  Share,
  Sparkles,
  Store,
  Trash2,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { MicButton } from "@/components/shell/mic-button";
import { TabBar } from "@/components/shell/tab-bar";
import { VoiceCapture } from "@/components/shell/voice-capture";
import { Button } from "@/components/ui/button";
import { Badge, Chip, Segmented, Switch } from "@/components/ui/controls";
import { EmptyState, PageHeader, SkeletonList } from "@/components/ui/feedback";
import { SearchField, TextField } from "@/components/ui/field";
import { ListGroup, ListRow } from "@/components/ui/list";
import { AlertDialog, Sheet } from "@/components/ui/overlay";
import { ToastProvider, useToast } from "@/components/ui/toast";
import type { Lang } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import type { Recording } from "@/lib/audio/use-recorder";

type Theme = "phone" | "light" | "dark";

export function StyleGuide() {
  const [theme, setTheme] = useState<Theme>("phone");
  return (
    <div data-theme={theme === "phone" ? undefined : theme} className="min-h-dvh bg-bg text-ink">
      <ToastProvider>
        <Guide theme={theme} setTheme={setTheme} />
      </ToastProvider>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="px-4">
        <h2 className="text-title font-bold tracking-tight">{title}</h2>
        {note && <p className="text-footnote text-ink-2">{note}</p>}
      </div>
      {children}
    </section>
  );
}

const SWATCHES: Array<{ name: string; className: string; use: string }> = [
  { name: "accent", className: "bg-accent-fill", use: "Primary buttons, links, active tab" },
  { name: "ink", className: "bg-ink", use: "Body text" },
  { name: "ink-2", className: "bg-ink-2", use: "Secondary text" },
  { name: "bg", className: "bg-bg", use: "Page background" },
  { name: "surface", className: "bg-surface", use: "Lists, cards, sheets" },
  { name: "fill", className: "bg-fill", use: "Inputs, tracks" },
  { name: "success", className: "bg-success", use: "In stock, good reviews" },
  { name: "danger", className: "bg-danger", use: "Out of stock, delete, errors" },
  { name: "check", className: "bg-check", use: "Please check" },
  { name: "turmeric", className: "bg-turmeric", use: "Low-stock fill only" },
  { name: "record", className: "bg-record", use: "Mic while recording" },
];

const PRODUCTS = [
  { name: "Aashirvaad Atta 5 kg", price: "₹285", stock: 3, tone: "low" as const },
  { name: "Maggi Masala Noodles", price: "₹14", stock: 46, tone: "ok" as const },
  { name: "Surf Excel 1 kg", price: "₹140", stock: 0, tone: "out" as const },
];

function Guide({ theme, setTheme }: { theme: Theme; setTheme: (theme: Theme) => void }) {
  const { lang, setLang, t } = useLang();
  const toast = useToast();
  const [clip, setClip] = useState<Recording | null>(null);
  const clipUrl = useMemo(() => (clip ? URL.createObjectURL(new Blob([clip.wav], { type: "audio/wav" })) : null), [clip]);
  useEffect(() => () => void (clipUrl && URL.revokeObjectURL(clipUrl)), [clipUrl]);
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState("All");
  const [published, setPublished] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-10 pb-16">
      <PageHeader title="Design" subtitle="Shelf Voice · E-32" />

      {/* Preview controls stay at the top so every section can be checked both ways. */}
      <div className="sticky top-0 z-30 flex flex-col gap-2 border-b border-separator bg-chrome px-4 py-3 backdrop-blur-xl">
        <Segmented<Theme>
          label={t("theme.label")}
          value={theme}
          onValueChange={setTheme}
          options={[
            { value: "phone", label: t("theme.phone") },
            { value: "light", label: t("theme.light") },
            { value: "dark", label: t("theme.dark") },
          ]}
        />
        <Segmented<Lang>
          label={t("lang.label")}
          value={lang}
          onValueChange={setLang}
          options={[
            { value: "en", label: "English" },
            { value: "hi", label: <span lang="hi">हिन्दी</span> },
          ]}
        />
      </div>

      <Section title="Colour" note="Every text pair passes 4.5:1. Turmeric never carries text on white.">
        <ul className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3">
          {SWATCHES.map((s) => (
            <li key={s.name} className="flex items-center gap-3 rounded-md bg-surface p-3 shadow-card">
              <span aria-hidden className={`size-10 shrink-0 rounded-sm border border-separator ${s.className}`} />
              <span className="min-w-0">
                <span className="block text-footnote font-semibold">{s.name}</span>
                <span className="block text-footnote text-ink-2">{s.use}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Type" note="The phone's own font; Hindi in Noto Sans Devanagari. Scale 14 · 16 · 20 · 24 · 32 · 40.">
        <div className="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-card mx-4">
          <p className="font-display text-figure font-bold tabular-nums tracking-tight">₹2,450</p>
          <p className="font-display text-large-title font-bold tracking-tight">{t("tab.today")}</p>
          <p className="text-title font-semibold">{t("app.name")}</p>
          <p className="text-headline font-semibold">{t("empty.stock.title")}</p>
          <p className="text-body">{t("app.tagline")}</p>
          <p className="text-footnote text-ink-2">{t("status.offline")}</p>
        </div>
      </Section>

      <Section title="Buttons" note="48 px minimum. One filled button per screen; it sits in the thumb zone.">
        <div className="flex flex-col gap-3 px-4">
          <Button size="lg" icon={<CircleCheck aria-hidden className="size-5" />}>
            {t("action.confirmAll")}
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="tinted" icon={<Share aria-hidden className="size-5" />}>
              {t("action.share")}
            </Button>
            <Button variant="gray">{t("action.edit")}</Button>
            <Button variant="plain">{t("action.cancel")}</Button>
            <Button variant="destructive" icon={<Trash2 aria-hidden className="size-5" />}>
              {t("action.delete")}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button loading>{t("action.save")}</Button>
            <Button disabled>{t("action.save")}</Button>
          </div>
        </div>
      </Section>

      <Section title="Lists" note="Inset grouped rows. Numbers and status sit on the right.">
        <div className="flex flex-col gap-6 px-4">
          <ListGroup header={t("tab.stock")} footer="3 of 15 products">
            {PRODUCTS.map((p) => (
              <ListRow
                key={p.name}
                icon={<Package />}
                iconTone={p.tone === "out" ? "danger" : p.tone === "low" ? "check" : "accent"}
                title={p.name}
                subtitle={p.price}
                value={
                  p.tone === "out" ? (
                    <Badge tone="danger" icon={<PackageX aria-hidden />}>
                      {t("status.outOfStock")}
                    </Badge>
                  ) : p.tone === "low" ? (
                    <Badge tone="low" icon={<TriangleAlert aria-hidden />}>
                      {p.stock} · {t("status.low")}
                    </Badge>
                  ) : (
                    <span className="tabular-nums">{p.stock}</span>
                  )
                }
                href="#"
              />
            ))}
          </ListGroup>
          <ListGroup header="My shop">
            <ListRow
              icon={<Store />}
              title="Published"
              titleId="published-title"
              accessory={<Switch checked={published} onCheckedChange={setPublished} labelledBy="published-title" />}
            />
            <ListRow icon={<Share />} title={t("action.share")} subtitle="shelfvoice.vercel.app/s/sharma-kirana" onClick={() => undefined} />
          </ListGroup>
        </div>
      </Section>

      <Section title="Inputs">
        <div className="flex flex-col gap-4 px-4">
          <SearchField label={t("search.placeholder")} clearLabel={t("search.clear")} value={search} onValueChange={setSearch} />
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]">
            {["All", "Atta & rice", "Snacks", "Soap", "Dairy"].map((c) => (
              <Chip key={c} selected={chip === c} onClick={() => setChip(c)}>
                {c}
              </Chip>
            ))}
          </div>
          <TextField label="Price (₹)" inputMode="decimal" defaultValue="285" hint="Customers see this on your shop page." />
          <TextField label="Shop name" defaultValue="" error="Please add your shop's name." />
        </div>
      </Section>

      <Section title="Status" note="Icon plus word, never colour alone.">
        <div className="flex flex-wrap gap-2 px-4">
          <Badge tone="success" icon={<CircleCheck aria-hidden />}>
            {t("status.inStock")}
          </Badge>
          <Badge tone="danger" icon={<PackageX aria-hidden />}>
            {t("status.outOfStock")}
          </Badge>
          <Badge tone="low" icon={<TriangleAlert aria-hidden />}>
            {t("status.low")}
          </Badge>
          <Badge tone="check" icon={<CircleAlert aria-hidden />}>
            {t("status.check")}
          </Badge>
          <Badge tone="accent" icon={<Sparkles aria-hidden />}>
            {t("status.new")}
          </Badge>
          <Badge>Draft</Badge>
        </div>
      </Section>

      <Section title="Mic" note="Doc 06 states: idle, recording (ring fills toward the limit, live level bars), sending, understanding, resting.">
        <div className="mx-4 grid grid-cols-3 justify-items-center gap-y-8 rounded-lg bg-surface py-8 shadow-card sm:grid-cols-5">
          <MicButton state="idle" />
          <MicButton state="recording" elapsedMs={12_000} maxSeconds={30} level={0.6} />
          <MicButton state="uploading" />
          <MicButton state="processing" />
          <MicButton state="paused" />
        </div>
        <div data-testid="live-recorder" className="mx-4 flex flex-col items-center gap-4 rounded-lg bg-surface px-4 pt-10 pb-6 shadow-card">
          <p className="text-footnote text-ink-2">Live recorder: tap, speak, tap again. Nothing is uploaded here.</p>
          <VoiceCapture size="hero" maxSeconds={15} onRecorded={setClip} />
          {clip && (
            <div className="flex w-full flex-col items-center gap-2">
              <p className="text-footnote text-ink-2 tabular-nums" data-testid="clip-info">
                {(clip.durationMs / 1000).toFixed(1)} s · 16 kHz mono WAV · {Math.round(clip.wav.byteLength / 1024)} KB
              </p>
              <audio controls src={clipUrl ?? undefined} className="w-full max-w-xs" />
            </div>
          )}
        </div>
      </Section>

      <Section title="Feedback" note="Loading, empty, toast, sheet and alert.">
        <div className="flex flex-col gap-4 px-4">
          <SkeletonList rows={3} label={t("status.loading")} />
          <EmptyState
            icon={<Inbox />}
            title={t("empty.stock.title")}
            body={t("empty.stock.body")}
            action={
              <Button size="lg" icon={<Mic aria-hidden className="size-5" />}>
                {t("mic.label")}
              </Button>
            }
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="tinted"
              icon={<Undo2 aria-hidden className="size-5" />}
              onClick={() =>
                toast.show({ message: t("toast.saved", { n: 3 }), action: { label: t("action.undo"), onAction: () => undefined } })
              }
            >
              Toast with Undo
            </Button>
            <Button variant="tinted" icon={<Camera aria-hidden className="size-5" />} onClick={() => setSheetOpen(true)}>
              Open sheet
            </Button>
            <Button variant="destructive" icon={<Trash2 aria-hidden className="size-5" />} onClick={() => setAlertOpen(true)}>
              Delete shop…
            </Button>
          </div>
        </div>
      </Section>

      <Section title="App shell" note="Large title, grouped content, frosted tab bar with the mic in the centre.">
        <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-[2.5rem] border-8 border-ink/90 bg-bg shadow-float">
          <div className="h-[560px] overflow-y-auto">
            <PageHeader title={t("tab.today")} subtitle="Sharma Kirana" />
            <div className="flex flex-col gap-5 px-4 pb-6">
              <div className="rounded-lg bg-surface p-4 shadow-card">
                <p className="text-footnote font-medium text-ink-2">Sales today</p>
                <p className="font-display text-figure font-bold tabular-nums tracking-tight">₹2,450</p>
                <p className="text-footnote text-success">▲ 12% vs last Tuesday</p>
              </div>
              <ListGroup header={t("status.low")}>
                <ListRow icon={<Package />} iconTone="check" title="Aashirvaad Atta 5 kg" value={<Badge tone="low">2 days</Badge>} href="#" />
                <ListRow icon={<Package />} iconTone="check" title="Amul Butter 100 g" value={<Badge tone="low">3 days</Badge>} href="#" />
              </ListGroup>
            </div>
          </div>
          <TabBar preview active="/app" mic={<MicButton state="idle" />} />
        </div>
      </Section>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Bill photo"
        doneLabel={t("action.done")}
        footer={<Button size="lg">{t("action.confirmAll")}</Button>}
      >
        <p className="text-body text-ink-2">
          Sheets slide up from the bottom on phones and hold one task, like checking a bill photo before saving it.
        </p>
      </Sheet>
      <AlertDialog
        open={alertOpen}
        onClose={() => setAlertOpen(false)}
        title="Delete your shop?"
        message="Your products, stock history and reviews will be removed for good."
        cancelLabel={t("action.cancel")}
        confirmLabel={t("action.delete")}
        destructive
        busy={busy}
        onConfirm={() => {
          setBusy(true);
          setTimeout(() => {
            setBusy(false);
            setAlertOpen(false);
          }, 900);
        }}
      />
    </div>
  );
}
