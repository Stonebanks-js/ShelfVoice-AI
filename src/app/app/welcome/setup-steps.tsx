"use client";

import { Candy, Check, ChevronLeft, CircleAlert, Croissant, MapPin, Shapes, ShoppingBasket, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import type { Lang, MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { api, ApiFailure } from "@/lib/api";
import { cn } from "@/lib/cn";
import { errorKey } from "@/lib/errors";

const LANGS: Array<{ value: Lang; name: string; sample: string }> = [
  { value: "hi", name: "हिन्दी", sample: "नमस्ते! आज क्या बिका?" },
  { value: "en", name: "English", sample: "Hello! What sold today?" },
];

// Saved as the shop's category, which the storefront shows and the
// ready-made lists read (typeForCategory).
const TYPES: Array<{ category: string | null; label: MessageKey; icon: ReactNode }> = [
  { category: "Kirana", label: "type.kirana", icon: <ShoppingBasket /> },
  { category: "Departmental store", label: "type.departmental", icon: <Store /> },
  { category: "Dairy and bakery", label: "type.dairy_bakery", icon: <Croissant /> },
  { category: "Pan shop", label: "type.pan", icon: <Candy /> },
  { category: null, label: "type.other", icon: <Shapes /> },
];

const STEPS = 4;

type Where = { lat: number; lng: number } | null;

// O-2 setup (doc 06, changed by E-36): four quick questions, one per screen,
// like the sign-up of a calorie-tracking app: language first so the rest
// reads in it, then the shop's name, its kind and where it is. Then the
// owner adds products.
export function SetupSteps({ initial }: { initial: Lang }) {
  const { setLang, t } = useLang();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [lang, setChoice] = useState<Lang>(initial);
  const [name, setName] = useState("");
  const [type, setType] = useState<number | null>(null);
  const [where, setWhere] = useState<Where>(null);
  const [locating, setLocating] = useState(false);
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  const pincodeBad = pincode.trim() !== "" && !/^[1-9][0-9]{5}$/.test(pincode.trim());

  function locate() {
    setError(null);
    if (!navigator.geolocation) return setError("setup.where.denied");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // About a metre is plenty for a shop.
        const round = (n: number) => Math.round(n * 100_000) / 100_000;
        setWhere({ lat: round(position.coords.latitude), lng: round(position.coords.longitude) });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError("setup.where.denied");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  async function finish() {
    if (pincodeBad) return setError("setup.where.badPincode");
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/shops", {
        json: {
          name: name.trim(),
          language: lang,
          category: type === null ? null : TYPES[type].category,
          address: address.trim() || null,
          pincode: pincode.trim() || null,
          ...(where ?? {}),
        },
      });
    } catch (failure) {
      // Already has a shop (another tab got there first): carry on.
      if (!(failure instanceof ApiFailure && failure.code === "SHOP_EXISTS")) {
        // Signed out, or an account that can't own a shop: start again.
        if (failure instanceof ApiFailure && [401, 403, 404].includes(failure.status)) {
          await api("/api/v1/auth/signout", { method: "POST" }).catch(() => undefined);
          router.replace("/");
          router.refresh();
          return;
        }
        setError(errorKey(failure));
        setBusy(false);
        return;
      }
    }
    router.replace("/app/setup");
    router.refresh();
  }

  const next = () => {
    setError(null);
    setStep(step + 1);
  };
  const canGoOn = step === 1 ? name.trim().length > 0 : step === 2 ? type !== null : true;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-3">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            aria-label={t("action.back")}
            className="-ml-2 grid size-11 shrink-0 place-items-center rounded-full text-ink active:bg-fill"
          >
            <ChevronLeft aria-hidden className="size-6" />
          </button>
        ) : (
          <span aria-hidden className="size-11 shrink-0" />
        )}
        <div
          role="progressbar"
          aria-label={t("setup.step", { n: step + 1, total: STEPS })}
          aria-valuemin={1}
          aria-valuemax={STEPS}
          aria-valuenow={step + 1}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill"
        >
          <div className="h-full rounded-full bg-accent-fill transition-[width] duration-300" style={{ width: `${((step + 1) / STEPS) * 100}%` }} />
        </div>
        <span className="w-11 shrink-0 text-right text-footnote text-ink-2 tabular-nums">
          {step + 1}/{STEPS}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-6 pt-8">
        {step === 0 && (
          <>
            <Heading title={t("welcome.title")} body={t("welcome.body")} />
            <div role="radiogroup" aria-label={t("lang.label")} className="flex flex-col gap-3">
              {LANGS.map((c) => (
                <Option
                  key={c.value}
                  selected={c.value === lang}
                  lang={c.value}
                  onClick={() => {
                    setChoice(c.value);
                    setLang(c.value); // the screens switch as soon as it's tapped
                  }}
                  title={c.name}
                  body={c.sample}
                />
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <Heading title={t("setup.name.title")} body={t("setup.name.body")} />
            <TextField
              label={t("setup.name.label")}
              placeholder={t("setup.name.placeholder")}
              value={name}
              maxLength={80}
              autoComplete="organization"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && canGoOn && next()}
            />
          </>
        )}

        {step === 2 && (
          <>
            <Heading title={t("setup.type.title")} body={t("setup.type.body")} />
            <div role="radiogroup" aria-label={t("setup.type.title")} className="grid grid-cols-2 gap-3">
              {TYPES.map((option, index) => (
                <button
                  key={option.label}
                  type="button"
                  role="radio"
                  aria-checked={type === index}
                  onClick={() => setType(index)}
                  className={cn(
                    "flex gap-2 rounded-lg bg-surface p-4 text-left shadow-card transition-transform active:scale-[0.98] [&>svg]:size-7",
                    // The last choice, Other, spans the row as one line.
                    index === TYPES.length - 1 ? "col-span-2 min-h-16 flex-row items-center gap-3" : "min-h-24 flex-col items-start justify-between",
                    type === index && "ring-3 ring-accent",
                  )}
                >
                  {option.icon}
                  <span className="text-headline font-semibold">{t(option.label)}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <Heading title={t("setup.where.title")} body={t("setup.where.body")} />
            <Button
              variant={where ? "gray" : "tinted"}
              size="lg"
              loading={locating}
              icon={where ? <Check aria-hidden className="size-5" /> : <MapPin aria-hidden className="size-5" />}
              onClick={locate}
            >
              {locating ? t("setup.where.locating") : where ? t("setup.where.located") : t("setup.where.locate")}
            </Button>
            <TextField label={t("field.address")} value={address} maxLength={300} autoComplete="street-address" onChange={(event) => setAddress(event.target.value)} />
            <TextField
              label={t("field.pincode")}
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={6}
              value={pincode}
              onChange={(event) => setPincode(event.target.value.replace(/\D/g, ""))}
              error={pincodeBad ? t("setup.where.badPincode") : undefined}
            />
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 pt-6">
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-4 py-3 text-footnote text-danger">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t(error)}
          </p>
        )}
        {step < STEPS - 1 ? (
          <Button size="lg" disabled={!canGoOn} onClick={next}>
            {t("action.next")}
          </Button>
        ) : (
          <Button size="lg" loading={busy} icon={busy ? undefined : <Check aria-hidden className="size-5" />} onClick={finish}>
            {t("setup.finish")}
          </Button>
        )}
      </div>
    </main>
  );
}

function Heading({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h1 className="font-display text-large-title font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-body text-ink-2">{body}</p>
    </div>
  );
}

function Option({ selected, lang, onClick, title, body }: { selected: boolean; lang: Lang; onClick: () => void; title: string; body: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      lang={lang}
      onClick={onClick}
      className={cn(
        "flex min-h-20 items-center gap-4 rounded-lg bg-surface px-5 text-left shadow-card transition-[box-shadow,transform] active:scale-[0.99]",
        selected && "ring-3 ring-accent",
      )}
    >
      <span className="flex-1">
        <span className="block text-title font-semibold">{title}</span>
        <span className="block text-footnote text-ink-2">{body}</span>
      </span>
      <span
        aria-hidden
        className={cn("grid size-7 place-items-center rounded-full border-2", selected ? "border-accent-fill bg-accent-fill text-on-accent" : "border-separator")}
      >
        {selected && <Check className="size-4" strokeWidth={3} />}
      </span>
    </button>
  );
}
