"use client";

import { Camera, CircleAlert, Images, Layers, LoaderCircle, RotateCcw, ScanLine, Sun, Maximize, Printer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button, buttonClass } from "@/components/ui/button";
import { IconTile } from "@/components/ui/list";
import type { MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { api, ApiFailure } from "@/lib/api";
import { uploadFile } from "@/lib/audio/upload";
import { errorKey } from "@/lib/errors";
import { prepareJpeg } from "@/lib/image";

type Step = "pick" | "preview" | "reading";
export type CameraMode = "bill" | "shelf";

// The words and tips for each kind of photo: a supplier's bill (O-10), or a
// shelf whose products become new ones to add (V-01).
const COPY = {
  bill: {
    title: "camera.title",
    body: "camera.body",
    tips: [
      { icon: <Sun />, text: "camera.tip1" },
      { icon: <Maximize />, text: "camera.tip2" },
      { icon: <Printer />, text: "camera.tip3" },
    ],
    reading: "camera.reading",
    unreadable: "camera.error.read",
  },
  shelf: {
    title: "shelf.title",
    body: "shelf.body",
    tips: [
      { icon: <Maximize />, text: "shelf.tip1" },
      { icon: <Sun />, text: "shelf.tip2" },
      { icon: <Layers />, text: "shelf.tip3" },
    ],
    reading: "shelf.reading",
    unreadable: "shelf.error.read",
  },
} satisfies Record<CameraMode, { title: MessageKey; body: MessageKey; tips: Array<{ icon: ReactNode; text: MessageKey }>; reading: MessageKey; unreadable: MessageKey }>;

// What the photo reader's failures mean for the owner.
function photoErrorKey(error: unknown, mode: CameraMode): MessageKey {
  if (error instanceof ApiFailure) {
    if (error.code === "AI_PAUSED") return "mic.paused";
    if (["AI_UNAVAILABLE", "AI_NOT_UNDERSTOOD", "BAD_IMAGE"].includes(error.code)) return COPY[mode].unreadable;
    return errorKey(error);
  }
  return "camera.error.image"; // the photo itself couldn't be prepared
}

export function CameraScreen({ mode = "bill" }: { mode?: CameraMode }) {
  const copy = COPY[mode];
  const { t } = useLang();
  const router = useRouter();
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [step, setStep] = useState<Step>("pick");
  const [error, setError] = useState<MessageKey | null>(null);

  // Free the preview's memory when the photo changes or the screen closes.
  useEffect(() => () => void (photo && URL.revokeObjectURL(photo.url)), [photo]);

  function picked(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setPhoto({ file, url: URL.createObjectURL(file) });
    setStep("preview");
  }

  async function use() {
    if (!photo) return;
    setStep("reading");
    setError(null);
    try {
      const { bytes } = await prepareJpeg(photo.file);
      const path = await uploadFile(mode, bytes, "image/jpeg");
      const { proposal } = await api<{ proposal: { id: string } }>(`/api/v1/proposals/${mode}`, { json: { path } });
      router.push(`/app/check/${proposal.id}`);
    } catch (failure) {
      setError(photoErrorKey(failure, mode));
      setStep("preview");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <h1 className="font-display text-large-title font-bold tracking-tight">{t(copy.title)}</h1>

      {step === "pick" ? (
        <>
          <p className="mt-2 text-body text-ink-2">{t(copy.body)}</p>
          {/* Doc 06 viewfinder guide: how the bill should sit in the photo. */}
          <div aria-hidden className="mt-6 grid aspect-[4/3] max-h-[34dvh] w-full place-items-center rounded-xl border-2 border-dashed border-ink-3 bg-surface">
            <ScanLine className="size-16 text-ink-3" />
          </div>
          <ul className="mt-6 flex flex-col gap-3">
            {copy.tips.map((tip) => (
              <li key={tip.text} className="flex items-center gap-3 text-body">
                <IconTile icon={tip.icon} />
                {t(tip.text)}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <figure className="mt-4 flex flex-1 flex-col gap-2">
          <figcaption className="text-footnote font-semibold text-ink-2">{t("camera.preview")}</figcaption>
          <div className="relative min-h-64 flex-1 overflow-hidden rounded-xl bg-fill">
            {/* A local preview of the owner's own photo; nothing to optimise. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo?.url} alt={t("camera.preview")} className="absolute inset-0 size-full object-contain" />
            {step === "reading" && (
              <div role="status" className="absolute inset-0 grid place-items-center bg-scrim">
                <span className="flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-body font-semibold text-ink shadow-float">
                  <LoaderCircle aria-hidden className="size-5 animate-spin" />
                  {t(copy.reading)}
                </span>
              </div>
            )}
          </div>
        </figure>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-4 py-3 text-footnote text-danger">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t(error)}
          </p>
        )}
        {step === "pick" ? (
          <>
            <Button size="lg" icon={<Camera aria-hidden className="size-5" />} onClick={() => cameraInput.current?.click()}>
              {t("camera.take")}
            </Button>
            <Button variant="gray" icon={<Images aria-hidden className="size-5" />} onClick={() => galleryInput.current?.click()}>
              {t("camera.choose")}
            </Button>
          </>
        ) : (
          <>
            <Button size="lg" loading={step === "reading"} onClick={use}>
              {t("camera.use")}
            </Button>
            <Button
              variant="gray"
              disabled={step === "reading"}
              icon={<RotateCcw aria-hidden className="size-5" />}
              onClick={() => cameraInput.current?.click()}
            >
              {t("camera.retake")}
            </Button>
          </>
        )}
        <Link href={mode === "shelf" ? "/app/add" : "/app/stock"} className={buttonClass("plain", "md")}>
          {t("action.cancel")}
        </Link>
      </div>

      {/* The phone's own camera app (rear camera), or its gallery. */}
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-label={t("camera.take")}
        onChange={(event) => {
          picked(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        hidden
        aria-label={t("camera.choose")}
        onChange={(event) => {
          picked(event.target.files);
          event.target.value = "";
        }}
      />
    </main>
  );
}
