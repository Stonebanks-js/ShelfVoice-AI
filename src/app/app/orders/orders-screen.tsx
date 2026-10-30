"use client";

import { Camera, CircleAlert, CircleCheck, Info, PackageCheck, Share } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/field";
import { Sheet } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import type { MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { errorKey } from "@/lib/errors";
import type { RestockItem } from "@/server/restock";

export function OrdersScreen({ items, shopName }: { items: RestockItem[]; shopName: string }) {
  const { t } = useLang();
  const toast = useToast();
  const [delivering, setDelivering] = useState<RestockItem | null>(null);
  const toOrder = items.filter((i) => (i.orderQty ?? 0) > 0);

  // Sends the list to the supplier the way owners already do: a message.
  async function share() {
    const text = [t("orders.shareTitle", { shop: shopName }), ...toOrder.map((i) => `• ${i.name}${i.unit ? ` (${i.unit})` : ""} × ${i.orderQty}`)].join("\n");
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // Cancelled, or share unavailable here: fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.show({ message: t("orders.copied") });
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-4">
      <PageHeader
        title={t("tab.orders")}
        subtitle={items.length ? t("orders.count", { n: items.length }) : undefined}
        trailing={
          <div className="flex gap-2">
            {/* Deliveries usually come with a bill: read it instead of typing. */}
            <ButtonLink href="/app/camera" variant="gray" icon={<Camera aria-hidden className="size-5" />}>
              {t("camera.scan")}
            </ButtonLink>
            {toOrder.length > 0 && (
              <Button variant="tinted" icon={<Share aria-hidden className="size-5" />} onClick={share}>
                {t("orders.share")}
              </Button>
            )}
          </div>
        }
      />

      {items.some((i) => i.coldStart) && (
        <p className="mx-4 flex gap-2 rounded-lg bg-accent-soft p-4 text-footnote text-accent">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t("orders.cold")}
        </p>
      )}

      {items.length === 0 ? (
        <div className="px-4">
          <EmptyState icon={<CircleCheck />} title={t("orders.empty.title")} body={t("orders.empty.body")} />
        </div>
      ) : (
        <ul className="flex flex-col gap-3 px-4">
          {items.map((item) => (
            <ReorderRow key={item.productId} item={item} onDelivered={() => setDelivering(item)} />
          ))}
        </ul>
      )}

      {delivering && <DeliverySheet item={delivering} onClose={() => setDelivering(null)} />}
    </main>
  );
}

// Doc 06 ReorderRow: days left (large), order quantity, reason line and the
// review flag. Numbers are the biggest text on the screen (doc 06 objective 3).
function ReorderRow({ item, onDelivered }: { item: RestockItem; onDelivered: () => void }) {
  const { t } = useLang();
  const whole = item.daysLeft === null ? null : Math.floor(item.daysLeft);
  const urgent = whole !== null && whole <= 1;
  return (
    <li className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card">
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex w-16 shrink-0 flex-col items-center rounded-md py-2",
            urgent ? "bg-turmeric text-on-turmeric" : "bg-fill text-ink",
          )}
        >
          {whole === null ? (
            <span className="text-footnote font-semibold">{t("status.low")}</span>
          ) : whole <= 0 ? (
            <>
              <span className="font-display text-headline font-bold">{t("orders.todayFigure")}</span>
              <span className="text-footnote">{t("orders.todayLabel")}</span>
            </>
          ) : (
            <>
              <span className="font-display text-title font-bold tabular-nums">{whole}</span>
              <span className="text-center text-footnote leading-tight">{t(whole === 1 ? "orders.dayLabel" : "orders.daysLabel")}</span>
            </>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-headline font-semibold">
            {item.name}
            {item.unit && <span className="font-normal text-ink-2"> · {item.unit}</span>}
          </h2>
          {item.customerFlagged && (
            <p className="flex items-center gap-1 text-footnote font-semibold text-danger">
              <CircleAlert aria-hidden className="size-4" />
              {t("today.low.flagged")}
            </p>
          )}
          <p className="text-footnote text-ink-2">
            {item.coldStart ? t("orders.coldReason", { stock: item.stock ?? 0, level: item.lowStockLevel }) : item.reason}
          </p>
        </div>
        {!item.coldStart && (item.orderQty ?? 0) > 0 && (
          <div className="shrink-0 text-right">
            <p className="font-display text-title font-bold tabular-nums">{item.orderQty}</p>
            <p className="text-footnote text-ink-2">{t("orders.orderLabel")}</p>
          </div>
        )}
      </div>
      <Button variant="gray" icon={<PackageCheck aria-hidden className="size-5" />} onClick={onDelivered} className="self-start">
        {t("orders.delivered")}
      </Button>
    </li>
  );
}

// Logs what the supplier actually brought, which refreshes the forecast.
function DeliverySheet({ item, onClose }: { item: RestockItem; onClose: () => void }) {
  const { t } = useLang();
  const router = useRouter();
  const toast = useToast();
  const [qty, setQty] = useState(String(item.orderQty && item.orderQty > 0 ? item.orderQty : ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  async function save() {
    const n = Number.parseInt(qty, 10);
    if (!(n > 0)) return setError("error.invalidChange");
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/stock-movements", {
        json: { product_id: item.productId, kind: "DELIVERY", qty: n, idempotency_key: crypto.randomUUID() },
      });
      toast.show({ message: t("orders.deliveredSaved", { name: item.name, qty: n }) });
      onClose();
      router.refresh();
    } catch (failure) {
      setError(errorKey(failure));
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={t("orders.delivered")}
      doneLabel={t("action.cancel")}
      footer={
        <Button size="lg" loading={busy} onClick={save}>
          {t("action.save")}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <TextField
          label={t("orders.deliveredTitle", { name: item.name })}
          inputMode="numeric"
          value={qty}
          onChange={(event) => setQty(event.target.value)}
          error={error ? t(error) : undefined}
        />
      </div>
    </Sheet>
  );
}
