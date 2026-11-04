"use client";

import { Check, ImageOff, Search } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ProductThumb } from "@/components/ui/product-thumb";
import type { MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { errorKey } from "@/lib/errors";
import type { PhotoCandidate } from "@/server/product-photos";

// The product's photo in its sheet (V-11): what customers see now, and a
// search of Open Food Facts the owner chooses from. Nothing is saved until a
// photo is tapped; the product works the same without one.
export function PhotoPicker({
  productId,
  name,
  category,
  photoUrl,
  ownPhoto,
  onChanged,
}: {
  productId: string;
  name: string;
  category: string | null;
  photoUrl: string | null;
  ownPhoto: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const { t } = useLang();
  const [state, setState] = useState<"idle" | "searching" | "shown" | "saving">("idle");
  const [candidates, setCandidates] = useState<PhotoCandidate[]>([]);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState<MessageKey | null>(null);

  async function search() {
    setError(null);
    setState("searching");
    try {
      const found = await api<{ available: boolean; candidates: PhotoCandidate[] }>(`/api/v1/products/${productId}/photo`);
      setAvailable(found.available);
      setCandidates(found.candidates);
      setState("shown");
    } catch (failure) {
      setError(errorKey(failure));
      setState("idle");
    }
  }

  async function choose(code: string | null) {
    setError(null);
    setState("saving");
    try {
      if (code) await api(`/api/v1/products/${productId}/photo`, { method: "PUT", json: { code } });
      else await api(`/api/v1/products/${productId}/photo`, { method: "DELETE" });
      setCandidates([]);
      setState("idle");
      await onChanged();
    } catch (failure) {
      setError(errorKey(failure));
      setState("shown");
    }
  }

  return (
    <section aria-labelledby={`photo-${productId}`} className="flex flex-col gap-2">
      <h3 id={`photo-${productId}`} className="px-1 text-footnote font-medium text-ink-2">
        {t("photo.title")}
      </h3>
      <div className="flex items-center gap-3 rounded-md bg-surface p-3 shadow-card">
        <ProductThumb name={name} category={category} imageUrl={photoUrl} size="md" />
        <p className="flex-1 text-footnote text-ink-2">{t(photoUrl ? "photo.shown" : "photo.none")}</p>
        {ownPhoto && (
          <Button variant="plain" disabled={state === "saving"} onClick={() => void choose(null)}>
            {t("action.remove")}
          </Button>
        )}
      </div>
      {state !== "shown" && (
        <Button variant="tinted" loading={state === "searching"} icon={<Search aria-hidden className="size-5" />} onClick={() => void search()}>
          {t("photo.find")}
        </Button>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-footnote text-danger">
          {t(error)}
        </p>
      )}
      {(state === "shown" || state === "saving") &&
        (candidates.length === 0 ? (
          <p role="status" className="flex items-start gap-2 rounded-md bg-fill px-4 py-3 text-footnote text-ink">
            <ImageOff aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t(available ? "photo.noneFound" : "photo.unavailable")}
          </p>
        ) : (
          <>
            <p className="px-1 text-footnote text-ink-2">{t("photo.pick")}</p>
            <ul aria-label={t("photo.title")} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {candidates.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    disabled={state === "saving"}
                    onClick={() => void choose(c.code)}
                    className="flex w-full flex-col gap-1.5 rounded-md bg-surface p-2 text-left shadow-card active:scale-[0.98] disabled:opacity-60"
                  >
                    <ProductThumb name={c.name} imageUrl={c.imageUrl} size="lg" />
                    <span className="line-clamp-2 text-footnote font-medium">{c.name}</span>
                    <span className={cn("flex items-center gap-1 text-footnote", c.status === "uncertain" ? "text-ink-2" : "text-success")}>
                      {c.status !== "uncertain" && <Check aria-hidden className="size-4" />}
                      {c.quantity ?? t("photo.sizeUnknown")}
                      {c.status === "uncertain" && ` · ${t("photo.checkSize")}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="px-1 text-footnote text-ink-2">{t("photo.credit")}</p>
          </>
        ))}
    </section>
  );
}
