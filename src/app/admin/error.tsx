"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

// Same "Couldn't load" state as the owner app, in English for the team.
export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main lang="en" className="mx-auto w-full max-w-2xl px-4 pt-16">
      <EmptyState
        icon={<WifiOff />}
        title="Couldn't load the numbers"
        body="Check the connection and try again."
        action={
          <Button size="lg" icon={<RefreshCw aria-hidden className="size-5" />} onClick={() => retry()}>
            Try again
          </Button>
        }
      />
    </main>
  );
}
