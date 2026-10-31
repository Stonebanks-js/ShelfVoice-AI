"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

// Sign-in, the storefront, the review page and privacy have no language
// provider above them here, so this says it in both (the owner app has its
// own, in the owner's language).
export default function PublicError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-16">
      <EmptyState
        icon={<WifiOff />}
        title="यह पेज नहीं खुल पाया · Couldn't load this page"
        body="इंटरनेट जाँचें और फिर कोशिश करें। Check the connection and try again."
        action={
          <Button size="lg" icon={<RefreshCw aria-hidden className="size-5" />} onClick={() => retry()}>
            फिर कोशिश करें · Try again
          </Button>
        }
      />
    </main>
  );
}
