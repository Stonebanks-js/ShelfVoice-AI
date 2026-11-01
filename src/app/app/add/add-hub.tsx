"use client";

import { Camera, FileSpreadsheet, ListChecks, Mic, ReceiptText, ScanBarcode } from "lucide-react";
import Link from "next/link";

import { buttonClass } from "@/components/ui/button";
import { ListGroup, ListRow } from "@/components/ui/list";
import { useLang } from "@/i18n/lang";

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
          : "mx-auto flex w-full max-w-2xl flex-col gap-6 pb-4"
      }
    >
      <header className={firstRun ? "flex flex-col gap-3 px-6" : "flex flex-col gap-2 px-4 pt-[max(1.5rem,env(safe-area-inset-top))]"}>
        <h1 className="font-display text-large-title font-bold tracking-tight">{t(firstRun ? "add.firstTitle" : "add.title")}</h1>
        <p className="text-body text-ink-2">{t("add.firstBody")}</p>
      </header>
      <ListGroup header={t("add.ways")} className="px-4">
        {ways.map((way) => (
          <ListRow key={way.href} href={way.href} icon={way.icon} title={way.title} subtitle={way.body} wrap />
        ))}
      </ListGroup>
      {firstRun && (
        <Link href="/app" className={buttonClass("plain", "md", "mt-auto self-center")}>
          {t("setup.skip")}
        </Link>
      )}
    </main>
  );
}
