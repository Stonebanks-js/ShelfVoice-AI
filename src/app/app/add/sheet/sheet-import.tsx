"use client";

import { CircleAlert, Download, FileSpreadsheet, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { AddToggle } from "@/components/ui/quantity";
import { useToast } from "@/components/ui/toast";
import type { MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { api } from "@/lib/api";
import { readSheet, TEMPLATE_CSV, type SheetResult } from "@/lib/catalog/sheet";
import { haveKey } from "@/lib/catalog/starter";
import { formatRupees } from "@/lib/changes-view";
import { errorKey } from "@/lib/errors";

const MAX_PRODUCTS = 500;
const SAMPLE = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE_CSV)}`;

// V-01 Excel or CSV: read in the browser, shown for ticking, then added in
// one go. Products the shop already has are marked and left out.
export function SheetImport({ have }: { have: string[] }) {
  const { t } = useLang();
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const owned = useMemo(() => new Set(have), [have]);
  const [file, setFile] = useState<{ name: string; result: SheetResult } | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  async function chosen(files: FileList | null) {
    const chosenFile = files?.[0];
    if (!chosenFile) return;
    setError(null);
    if (chosenFile.size > 5 * 1024 * 1024) return setError("sheet.error.big");
    setReading(true);
    try {
      const result = await readSheet(chosenFile);
      if (result.products.length === 0) {
        setFile(null);
        setError("sheet.error.empty");
      } else {
        setFile({ name: chosenFile.name, result });
        setPicked(new Set(result.products.flatMap((p, i) => (owned.has(haveKey(p.name, p.unit)) ? [] : [i]))));
      }
    } catch {
      setFile(null);
      setError("sheet.error.read");
    } finally {
      setReading(false);
    }
  }

  async function save() {
    if (!file) return;
    if (picked.size > MAX_PRODUCTS) return setError("sheet.error.tooMany");
    setBusy(true);
    setError(null);
    try {
      const products = file.result.products.filter((_, i) => picked.has(i));
      const result = await api<{ added: number; skipped: number }>("/api/v1/products/bulk", { json: { products } });
      toast.show({
        message: result.skipped ? t("list.savedSkipped", { n: result.added, skipped: result.skipped }) : t("list.saved", { n: result.added }),
      });
      router.replace("/app/stock");
      router.refresh();
    } catch (failure) {
      setError(errorKey(failure));
      setBusy(false);
    }
  }

  const toggle = (index: number) =>
    setPicked((set) => {
      const next = new Set(set);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const count = picked.size;
  const columns = file?.result.columns.map((c) => t(`sheet.col.${c}` as MessageKey)).join(", ");
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-44">
      <header className="flex flex-col gap-2 px-4 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <h1 className="font-display text-large-title font-bold tracking-tight">{t("add.sheet.title")}</h1>
        {!file && <p className="text-body text-ink-2">{t("sheet.body")}</p>}
      </header>

      {error && (
        <p role="alert" className="mx-4 flex items-start gap-2 rounded-md bg-danger-soft px-4 py-3 text-footnote text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t(error)}
        </p>
      )}

      {reading ? (
        <p role="status" className="mx-4 flex items-center gap-2 text-body text-ink-2">
          <LoaderCircle aria-hidden className="size-5 animate-spin" />
          {t("sheet.reading")}
        </p>
      ) : file ? (
        <section aria-labelledby="sheet-found" className="flex flex-col gap-1.5 px-4">
          <h2 id="sheet-found" className="px-1 text-footnote font-semibold text-ink-2">
            {t("sheet.found", { n: file.result.products.length, file: file.name })}
          </h2>
          <p className="px-1 text-footnote text-ink-2">
            {t("sheet.columns", { list: columns ?? "" })}
            {file.result.skipped > 0 && ` · ${t("sheet.skipped", { n: file.result.skipped })}`}
          </p>
          <ul className="overflow-hidden rounded-md bg-surface shadow-card">
            {file.result.products.map((product, index) => {
              const ownedHere = owned.has(haveKey(product.name, product.unit));
              const about = [
                product.unit,
                product.price_paise ? formatRupees(product.price_paise) : null,
                product.stock_qty !== null ? `${t("check.stock")} ${product.stock_qty}` : null,
                ownedHere ? t("list.have") : null,
              ].filter(Boolean);
              return (
                <li key={index} className="flex items-center gap-3 border-separator py-2.5 pr-3 pl-4 not-first:border-t">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-body text-ink">{product.name}</span>
                    {about.length > 0 && <span className="text-footnote text-ink-2">{about.join(" · ")}</span>}
                  </div>
                  {!ownedHere && (
                    <AddToggle
                      added={picked.has(index)}
                      onToggle={() => toggle(index)}
                      name={product.name}
                      addText={t("list.add")}
                      addedText={t("list.added")}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <div aria-hidden className="mx-4 grid aspect-[4/3] max-h-[30dvh] place-items-center rounded-xl border-2 border-dashed border-ink-3 bg-surface">
          <FileSpreadsheet className="size-16 text-ink-3" />
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-separator bg-chrome backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl flex-col gap-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {file ? (
            <>
              <Button size="lg" loading={busy} disabled={count === 0} onClick={save}>
                {count === 0 ? t("list.save0") : count === 1 ? t("list.save1") : t("list.saveN", { n: count })}
              </Button>
              <Button variant="plain" disabled={busy} onClick={() => input.current?.click()}>
                {t("sheet.another")}
              </Button>
            </>
          ) : (
            <>
              <Button size="lg" loading={reading} icon={<FileSpreadsheet aria-hidden className="size-5" />} onClick={() => input.current?.click()}>
                {t("sheet.choose")}
              </Button>
              <a href={SAMPLE} download="shelf-voice-products.csv" className="inline-flex min-h-12 items-center justify-center gap-2 font-semibold text-accent">
                <Download aria-hidden className="size-5" />
                {t("sheet.sample")}
              </a>
            </>
          )}
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        aria-label={t("sheet.choose")}
        onChange={(event) => {
          void chosen(event.target.files);
          event.target.value = "";
        }}
      />
    </main>
  );
}
