import { Store } from "lucide-react";
import Link from "next/link";

import { buttonClass } from "@/components/ui/button";

// Doc 06 P-2: no review page for an unknown or unpublished shop; a plain 404 in both
// languages, since there is no shop to take a language from.
export default function ReviewNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <span aria-hidden className="grid size-16 place-items-center rounded-full bg-accent-soft text-accent">
        <Store className="size-8" />
      </span>
      <h1 className="text-title font-bold">This shop isn&apos;t online right now</h1>
      <p lang="hi" className="text-headline font-semibold">
        यह दुकान अभी ऑनलाइन नहीं है
      </p>
      <p className="text-body text-ink-2">Check the link, or ask the shop for a new one.</p>
      <Link href="/" className={buttonClass("tinted", "md")}>
        Go to Shelf Voice
      </Link>
    </main>
  );
}
