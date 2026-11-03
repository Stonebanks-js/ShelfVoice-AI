"use client";

import { Camera, FileSpreadsheet, ListChecks, Mic, ReceiptText, ScanBarcode } from "lucide-react";
import Link from "next/link";

import { buttonClass } from "@/components/ui/button";
import { ListGroup, ListRow } from "@/components/ui/list";
import { useLang } from "@/i18n/lang";
import { cn } from "@/lib/cn";

// Every way to add products in one place (V-01, E-36): a kirana stocks far
// too much to speak item by item, so voice is one option among the faster
// ones. First run shows it full screen with Skip; later it's under Stock.
export function AddHub({ firstRun = false }: { firstRun?: boolean }) {
  const { t } = useLang();
  const ways = [
    { href: "/app/add/list", icon: <ListChecks />, title: t("add.list.title"), body: t("add.list.body") },
    { href: "/app/camera?mode=shelf", icon: <Camera />, title: t("add.shelf.title"), body: t("add.shelf.body") },
    { href: "/app/add/scan", icon: <ScanBarcode />, title: t("add.scan.title"), body: t("add.scan.body") },
    { href: "/app/camera", icon: <ReceiptText />, title: t("add.bill.title"), body: t("add.bill.body") },
    { href: "/app/add/sheet", icon: <FileSpreadsheet />, title: t("add.sheet.title"), body: t("add.sheet.body") },
    { href: "/app/setup/voice", icon: <Mic />, title: t("add.voice.title"), body: t("add.voice.body") },
  ];
  return (
    <main
      className={
        firstRun
          ? "mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          : "mx-auto flex w-full max-w-2xl flex-col gap-6 pb-4 lg:max-w-6xl lg:px-4"
      }
    >
      <header className={firstRun ? "flex flex-col gap-3 px-6" : "flex flex-col gap-2 px-4 pt-[max(1.5rem,env(safe-area-inset-top))]"}>
        <h1 className="font-display text-large-title font-bold tracking-tight">{t(firstRun ? "add.firstTitle" : "add.title")}</h1>
        <p className="text-body text-ink-2">{t("add.firstBody")}</p>
      </header>
      <ListGroup header={t("add.ways")} className={cn("px-4", !firstRun && "lg:hidden")}>
        {ways.map((way) => (
          <ListRow key={way.href} href={way.href} icon={way.icon} title={way.title} subtitle={way.body} wrap />
        ))}
      </ListGroup>
      {/* From 1024 px the ways are tiles side by side (E-37). */}
      {!firstRun && (
        <section aria-label={t("add.ways")} className="hidden grid-cols-3 gap-4 px-4 lg:grid">
          {ways.map((way, i) => (
            <Link
              key={way.href}
              href={way.href}
              className="group flex flex-col gap-3 rounded-xl bg-surface p-5 shadow-card transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-float active:scale-[0.98]"
            >
              <span
                aria-hidden
                className="grid size-12 place-items-center rounded-lg [&>svg]:size-6"
                style={{ background: `var(--cat-${(i % 8) + 1}-bg)`, color: `var(--cat-${(i % 8) + 1}-fg)` }}
              >
                {way.icon}
              </span>
              <span className="font-display text-headline font-bold tracking-tight">{way.title}</span>
              <span className="text-footnote text-ink-2">{way.body}</span>
            </Link>
          ))}
        </section>
      )}
      {firstRun && (
        <Link href="/app" className={buttonClass("plain", "md", "mt-auto self-center")}>
          {t("setup.skip")}
        </Link>
      )}
    </main>
  );
}
