"use client";

import { ChevronLeft, ChevronRight, CircleAlert, MapPin, Search, Store, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { OpenBadge } from "@/components/shell/open-badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Chip } from "@/components/ui/controls";
import { EmptyState } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/field";
import { localeFor, type MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { api } from "@/lib/api";
import { errorKey } from "@/lib/errors";
import { categoryLabel } from "@/lib/categories";
import { asHours } from "@/lib/hours";
import { placeFor } from "@/lib/place";

import { ShopMap } from "./shop-map";

interface NearbyShop {
  slug: string;
  name: string;
  category: string | null;
  address: string | null;
  pincode: string | null;
  hours: unknown;
  timezone: string;
  distanceKm: number | null;
  lat: number | null;
  lng: number | null;
  delivers: boolean;
}

// The last pincode searched, so coming back shows the same shops (testers).
const PINCODE_KEY = "sv_pincode";

// Customers (V-03, E-36): published shops near the phone, or in a typed
// pincode's area, nearest first. No account; each shop opens its page.
export function ShopFinder() {
  const { lang, t } = useLang();
  const [pincode, setPincode] = useState("");
  const [busy, setBusy] = useState<"locate" | "pincode" | null>(null);
  const [shops, setShops] = useState<NearbyShop[] | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  // Where the customer is, as rounded as the search: the map's blue dot.
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  // The pincode the results were measured from, when the search was by pincode.
  const [from, setFrom] = useState<string | null>(null);
  // Pincodes seen in this visit's results, kept as chips while moving between them.
  const [area, setArea] = useState<string[]>([]);

  async function search(query: string, how: "locate" | "pincode") {
    setBusy(how);
    setError(null);
    try {
      const { shops: found } = await api<{ shops: NearbyShop[] }>(`/api/v1/public/shops/nearby?${query}`);
      setShops(found);
      const codes = found.map((s) => s.pincode).filter((p): p is string => Boolean(p));
      setArea((seen) => [...new Set([...seen, ...codes])].slice(0, 8));
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
        const here = { lat: round(position.coords.latitude), lng: round(position.coords.longitude) };
        setMe(here);
        setFrom(null);
        void search(`lat=${here.lat}&lng=${here.lng}`, "locate");
        // The pincode box shows where the phone is, for a search next time.
        void placeFor(here).then((place) => place?.pincode && setPincode((now) => now || place.pincode!));
      },
      () => {
        setBusy(null);
        setError("shops.locationHelp");
      },
      { timeout: 15_000, maximumAge: 300_000 },
    );
  }

  function findPincode(code: string) {
    setPincode(code);
    setMe(null);
    setFrom(code);
    try {
      localStorage.setItem(PINCODE_KEY, code);
    } catch {
      // Private mode: not remembered.
    }
    void search(`pincode=${code}`, "pincode");
  }

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(PINCODE_KEY);
    } catch {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the browser
    if (saved && /^[1-9][0-9]{5}$/.test(saved)) findPincode(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const km = new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits: 1 });
  // "Kirana · 0.5 km away" (or "from 208006" after a pincode search).
  const describe = (shop: NearbyShop) =>
    [
      shop.category && categoryLabel(shop.category, t),
      shop.distanceKm === null
        ? t("shops.area")
        : from
          ? t("shops.kmFrom", { km: km.format(Math.max(shop.distanceKm, 0.1)), pincode: from })
          : t("shops.km", { km: km.format(Math.max(shop.distanceKm, 0.1)) }),
      t(shop.delivers ? "shops.delivers" : "shops.pickupOnly"),
    ]
      .filter(Boolean)
      .join(" · ");

  const pincodeOk = /^[1-9][0-9]{5}$/.test(pincode);
  // The map opens on the searched pincode's shops, not the whole 50 km.
  const focus = from && shops ? shops.filter((s) => s.pincode === from).map((s) => s.slug) : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-4 lg:max-w-6xl lg:px-8 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between">
        <Link href="/?who=1" className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-body font-semibold text-accent">
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
          if (!pincodeOk) return;
          findPincode(pincode);
        }}
      >
        <TextField
          label={t("field.pincode")}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          placeholder="208006"
          value={pincode}
          onChange={(event) => setPincode(event.target.value.replace(/\D/g, ""))}
          className="flex-1"
        />
        <Button type="submit" variant="tinted" loading={busy === "pincode"} disabled={!pincodeOk || busy !== null} icon={<Search aria-hidden className="size-5" />}>
          {t("shops.find")}
        </Button>
      </form>
      {pincode.length > 0 && pincode.length < 6 && <p className="-mt-3 px-1 text-footnote text-ink-2">{t("shops.pincodeHint")}</p>}

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-4 py-3 text-footnote text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t(error)}
        </p>
      )}

      {/* The buttons show the wait; this line only tells screen readers, so
          the page doesn't jump while searching (layout shift of 0.5 in tests). */}
      <p role="status" className="sr-only">
        {busy !== null && t("shops.looking")}
      </p>

      {shops !== null &&
        (shops.length === 0 ? (
          <EmptyState
            icon={<Store />}
            title={t("shops.none")}
            body={t(from ? "shops.noneTry" : "shops.noneBody")}
            action={
              <Link href="/owner" className={buttonClass("tinted", "md", "w-full")}>
                {t("shops.owner")}
              </Link>
            }
          />
        ) : (
          <>
          {area.length > 1 && (
            <section aria-labelledby="near-pincodes" className="flex flex-col gap-2">
              <h2 id="near-pincodes" className="text-footnote font-semibold text-ink-2">
                {t("shops.nearPincodes")}
              </h2>
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                {area.map((code) => (
                  <Chip key={code} selected={code === from} onClick={() => code !== from && findPincode(code)}>
                    <MapPin aria-hidden className="size-4" />
                    {code}
                  </Chip>
                ))}
              </div>
            </section>
          )}
          {/* The map above the list on a phone; beside it, pinned, from 1024 px (V-09). */}
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
            <ShopMap shops={shops.map((shop) => ({ ...shop, detail: describe(shop) }))} me={me} focus={focus?.length ? focus : null} className="h-64 sm:h-80 lg:sticky lg:top-6 lg:order-2 lg:h-[min(38rem,calc(100dvh-3rem))]" />
            {/* A new search is a new list, not the old one rearranged. */}
            <ul key={from ?? "here"} aria-label={t("shops.title")} className="flex flex-col gap-3 md:grid md:grid-cols-2 md:items-start lg:order-1 lg:grid-cols-1 lg:gap-4">
              {shops.map((shop) => (
                <li key={shop.slug}>
                  <Link href={`/s/${shop.slug}`} className="flex items-center gap-3 rounded-lg bg-surface p-4 shadow-card active:bg-fill">
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-headline font-semibold">{shop.name}</span>
                      <span className="text-footnote text-ink-2">
                        {describe(shop)}
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
          </div>
          </>
        ))}

      {/* The empty result already offers this. */}
      {shops?.length !== 0 && (
        <Link href="/owner" className="mt-auto inline-flex min-h-11 items-center self-center text-footnote font-semibold text-accent">
          {t("shops.owner")}
        </Link>
      )}
    </main>
  );
}
