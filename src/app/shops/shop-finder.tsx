"use client";

import { ChevronLeft, ChevronRight, CircleAlert, LoaderCircle, MapPin, Search, Store, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { OpenBadge } from "@/components/shell/open-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/field";
import type { MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { api } from "@/lib/api";
import { errorKey } from "@/lib/errors";
import { asHours } from "@/lib/hours";

interface NearbyShop {
  slug: string;
  name: string;
  category: string | null;
  address: string | null;
  hours: unknown;
  timezone: string;
  distanceKm: number | null;
}

// Customers (V-03, E-36): published shops near the phone, or in a typed
// pincode's area, nearest first. No account; each shop opens its page.
export function ShopFinder() {
  const { lang, t } = useLang();
  const [pincode, setPincode] = useState("");
  const [busy, setBusy] = useState<"locate" | "pincode" | null>(null);
  const [shops, setShops] = useState<NearbyShop[] | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);

  async function search(query: string, how: "locate" | "pincode") {
    setBusy(how);
    setError(null);
    try {
      const { shops: found } = await api<{ shops: NearbyShop[] }>(`/api/v1/public/shops/nearby?${query}`);
      setShops(found);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(null);
    }
  }

  function locate() {
    setError(null);
    if (!navigator.geolocation) return setError("shops.denied");
    setBusy("locate");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Rounded to about 100 m: enough to sort shops, no more.
        const round = (n: number) => Math.round(n * 1000) / 1000;
        void search(`lat=${round(position.coords.latitude)}&lng=${round(position.coords.longitude)}`, "locate");
      },
      () => {
        setBusy(null);
        setError("shops.denied");
      },
      { timeout: 15_000, maximumAge: 300_000 },
    );
  }

  const pincodeOk = /^[1-9][0-9]{5}$/.test(pincode);
  const km = new Intl.NumberFormat(lang === "hi" ? "hi-IN" : "en-IN", { maximumFractionDigits: 1 });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between">
        <Link href="/" className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-body font-semibold text-accent">
          <ChevronLeft aria-hidden className="size-5" />
          {t("action.back")}
        </Link>
        <Link href="/me" className="inline-flex min-h-11 items-center gap-1.5 px-2 text-footnote font-semibold text-accent">
          <UserRound aria-hidden className="size-5" />
          {t("store.account")}
        </Link>
      </div>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-large-title font-bold tracking-tight">{t("shops.title")}</h1>
        <p className="text-body text-ink-2">{t("shops.body")}</p>
      </header>

      <Button size="lg" loading={busy === "locate"} icon={<MapPin aria-hidden className="size-5" />} onClick={locate} disabled={busy !== null}>
        {t("shops.locate")}
      </Button>
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (pincodeOk) void search(`pincode=${pincode}`, "pincode");
        }}
      >
        <TextField
          label={t("field.pincode")}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          value={pincode}
          onChange={(event) => setPincode(event.target.value.replace(/\D/g, ""))}
          className="flex-1"
        />
        <Button type="submit" variant="tinted" loading={busy === "pincode"} disabled={!pincodeOk || busy !== null} icon={<Search aria-hidden className="size-5" />}>
          {t("shops.find")}
        </Button>
      </form>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-4 py-3 text-footnote text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t(error)}
        </p>
      )}

      {busy !== null && (
        <p role="status" className="flex items-center gap-2 text-footnote text-ink-2">
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
          {t("shops.looking")}
        </p>
      )}

      {shops !== null &&
        (shops.length === 0 ? (
          <EmptyState icon={<Store />} title={t("shops.none")} body={t("shops.noneBody")} />
        ) : (
          <ul aria-label={t("shops.title")} className="flex flex-col gap-3">
            {shops.map((shop) => (
              <li key={shop.slug}>
                <Link href={`/s/${shop.slug}`} className="flex items-center gap-3 rounded-lg bg-surface p-4 shadow-card active:bg-fill">
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-headline font-semibold">{shop.name}</span>
                    <span className="text-footnote text-ink-2">
                      {[shop.category, shop.distanceKm !== null ? t("shops.km", { km: km.format(Math.max(shop.distanceKm, 0.1)) }) : t("shops.area")]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {shop.address && <span className="line-clamp-2 text-footnote text-ink-2">{shop.address}</span>}
                    <span className="mt-1">
                      <OpenBadge hours={asHours(shop.hours)} timeZone={shop.timezone} />
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        ))}

      <Link href="/owner" className="mt-auto inline-flex min-h-11 items-center self-center text-footnote font-semibold text-accent">
        {t("shops.owner")}
      </Link>
    </main>
  );
}
