"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { useLang } from "@/i18n/lang";

// Doc 06 error state: "Couldn't load …" with Retry, never a raw error. The
// language provider lives in the layout, which keeps rendering around this.
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  const { t } = useLang();
  useEffect(() => {
    // Logged on the server too (onRequestError); this shows it in the browser console.
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-16">
      <EmptyState
        icon={<WifiOff />}
        title={t("screen.error.title")}
        body={t("screen.error.body")}
        action={
          <Button size="lg" icon={<RefreshCw aria-hidden className="size-5" />} onClick={() => retry()}>
            {t("action.retry")}
          </Button>
        }
      />
    </main>
  );
}
