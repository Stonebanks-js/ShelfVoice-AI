"use client";

import { CircleAlert, LoaderCircle, ScanBarcode, Search, VideoOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Sheet } from "@/components/ui/overlay";
import { PriceInput, paiseText, rupeesInput, Stepper } from "@/components/ui/quantity";
import { useToast } from "@/components/ui/toast";
import type { MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { api } from "@/lib/api";
import { errorKey } from "@/lib/errors";

// The browser's own barcode reader (Chrome on Android); not in TypeScript's DOM types yet.
interface Detector {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => Detector;
  }
}

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];
const isBarcode = (code: string) => /^[0-9]{8,14}$/.test(code);
const noSubscribe = () => () => undefined;

interface Product {
  id: string;
  name: string;
  unit: string | null;
  stock_qty: number | null;
}
interface Suggestion {
  name: string;
  unit: string | null;
  category: string | null;
  pricePaise: number | null;
  aliases: string[];
}
type Found = { code: string; product: Product | null; suggestion: Suggestion | null };

// V-01 barcodes: scan a pack (or type the number under the barcode). A pack
// the shop has gets its delivery logged; a new one is named from Open Food
// Facts when it's known there, or by the owner once, and the shop keeps the
// code so the next scan finds it.
export function BarcodeScan() {
  const { t } = useLang();
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const canScan = useSyncExternalStore(noSubscribe, () => "BarcodeDetector" in window && Boolean(navigator.mediaDevices), () => false);
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState("");
  const [looking, setLooking] = useState(false);
  const [found, setFound] = useState<Found | null>(null);
  const [saved, setSaved] = useState(0);
  const [error, setError] = useState<MessageKey | null>(null);

  function stop() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setScanning(false);
  }
  useEffect(() => stop, []);

  async function lookUp(value: string) {
    const digits = value.replace(/\D/g, "");
    if (!isBarcode(digits)) return setError("scan.bad");
    setError(null);
    setLooking(true);
    try {
      const result = await api<Omit<Found, "code">>(`/api/v1/barcodes/${digits}`);
      setFound({ code: digits, ...result });
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setLooking(false);
    }
  }

  async function start() {
    setError(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      stream.current = media;
      setScanning(true);
      const element = video.current!;
      element.srcObject = media;
      await element.play();
      const detector = new window.BarcodeDetector!({ formats: FORMATS });
      // Look a few times a second until a code is read or the camera stops.
      while (stream.current === media) {
        const codes = await detector.detect(element).catch(() => []);
        const hit = codes.map((c) => c.rawValue).find(isBarcode);
        if (hit) {
          stop();
          navigator.vibrate?.(30);
          await lookUp(hit);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    } catch (failure) {
      stop();
      setError(failure instanceof DOMException && failure.name === "NotAllowedError" ? "scan.denied" : "scan.noCamera");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <h1 className="font-display text-large-title font-bold tracking-tight">{t("add.scan.title")}</h1>
      <p className="text-body text-ink-2">{canScan ? t("scan.body") : t("scan.noCamera")}</p>

      {canScan && (
        <div className="relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-xl bg-fill">
          <video ref={video} muted playsInline className={scanning ? "absolute inset-0 size-full object-cover" : "hidden"} />
          {scanning ? (
            <span aria-hidden className="relative h-1/3 w-3/4 rounded-md border-2 border-white/90 shadow-[0_0_0_100vmax_rgb(0_0_0/0.35)]" />
          ) : (
            <ScanBarcode aria-hidden className="size-16 text-ink-3" />
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-4 py-3 text-footnote text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t(error)}
        </p>
      )}

      {canScan &&
        (scanning ? (
          <Button variant="gray" icon={<VideoOff aria-hidden className="size-5" />} onClick={stop}>
            {t("scan.stop")}
          </Button>
        ) : (
          <Button size="lg" icon={<ScanBarcode aria-hidden className="size-5" />} onClick={start} disabled={looking}>
            {t("scan.start")}
          </Button>
        ))}

      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void lookUp(code);
        }}
      >
        <TextField label={t("scan.type")} inputMode="numeric" autoComplete="off" value={code} onChange={(event) => setCode(event.target.value)} className="flex-1" />
        <Button type="submit" variant="tinted" loading={looking} icon={<Search aria-hidden className="size-5" />}>
          {t("scan.find")}
        </Button>
      </form>
      {looking && (
        <p role="status" className="flex items-center gap-2 text-footnote text-ink-2">
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
          {t("scan.looking")}
        </p>
      )}

      <div className="mt-auto flex flex-col items-center gap-2">
        {saved > 0 && (
          <p role="status" className="text-footnote text-ink-2">
            {t("scan.count", { n: saved })}
          </p>
        )}
        <Button
          variant={saved > 0 ? "filled" : "plain"}
          size={saved > 0 ? "lg" : "md"}
          onClick={() => {
            stop();
            router.push(saved > 0 ? "/app/stock" : "/app/add");
            router.refresh();
          }}
        >
          {t(saved > 0 ? "action.done" : "action.cancel")}
        </Button>
      </div>

      {found && (
        <ScanSheet
          key={found.code}
          found={found}
          onClose={() => setFound(null)}
          onSaved={() => {
            setFound(null);
            setCode("");
            setSaved((n) => n + 1);
          }}
        />
      )}
    </main>
  );
}

// What to do with one scanned code: log a delivery of a known product, or
// add a new one carrying the code.
function ScanSheet({ found, onClose, onSaved }: { found: Found; onClose: () => void; onSaved: () => void }) {
  const { t } = useLang();
  const toast = useToast();
  const [name, setName] = useState(found.suggestion?.name ?? "");
  const [unit, setUnit] = useState(found.suggestion?.unit ?? "");
  const [price, setPrice] = useState(paiseText(found.suggestion?.pricePaise));
  const [qty, setQty] = useState<number | null>(found.product ? 1 : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const label = found.product?.name ?? (name.trim() || t("scan.new"));

  async function save() {
    setError(null);
    if (!found.product && !name.trim()) return setError("error.invalidChange");
    if (!found.product && price.trim() && rupeesInput(price) === null) return setError("error.invalidChange");
    setBusy(true);
    try {
      if (found.product) {
        if (qty) {
          await api("/api/v1/stock-movements", {
            json: { product_id: found.product.id, kind: "DELIVERY", qty, idempotency_key: crypto.randomUUID() },
          });
        }
      } else {
        await api("/api/v1/products", {
          json: {
            name: name.trim(),
            unit: unit.trim() || null,
            category: found.suggestion?.category ?? null,
            aliases: found.suggestion?.aliases ?? [],
            price_paise: rupeesInput(price),
            stock_qty: qty,
            barcode: found.code,
          },
        });
      }
      toast.show({ message: t("scan.saved", { name: label }) });
      onSaved();
    } catch (failure) {
      setError(errorKey(failure));
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={found.product ? t("scan.have") : t("scan.new")}
      doneLabel={t("action.cancel")}
      footer={
        <Button size="lg" loading={busy} onClick={save}>
          {t("action.save")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-footnote text-ink-2">{t("scan.code", { code: found.code })}</p>
        {found.product ? (
          <p className="text-headline font-semibold">
            {found.product.name}
            {found.product.unit && <span className="font-normal text-ink-2"> · {found.product.unit}</span>}
          </p>
        ) : (
          <>
            <p className="rounded-md bg-fill px-3 py-2.5 text-footnote text-ink">{t(found.suggestion ? "scan.found" : "scan.unknown")}</p>
            <TextField label={t("field.name")} value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
            <TextField label={t("field.unit")} value={unit} onChange={(event) => setUnit(event.target.value)} autoComplete="off" />
            <label className="flex flex-col gap-1.5">
              <span className="px-1 text-footnote font-medium text-ink-2">{t("field.price")}</span>
              <PriceInput value={price} onChange={(event) => setPrice(event.target.value)} aria-invalid={price !== "" && rupeesInput(price) === null ? true : undefined} />
            </label>
          </>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-body">{found.product ? t("scan.addStock") : t("check.stock")}</span>
          <Stepper
            value={qty}
            onChange={setQty}
            clearable
            emptyLabel={found.product ? "0" : t("check.stockNone")}
            lessLabel={t("check.stockLess", { name: label })}
            moreLabel={t("check.stockMore", { name: label })}
          />
        </div>
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-4 py-3 text-footnote text-danger">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t(error)}
          </p>
        )}
      </div>
    </Sheet>
  );
}
