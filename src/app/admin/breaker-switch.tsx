"use client";

import { CircleAlert, Power } from "lucide-react";
import { useId, useState } from "react";

import { Badge, Switch } from "@/components/ui/controls";
import { ListGroup, ListRow } from "@/components/ui/list";
import { AlertDialog } from "@/components/ui/overlay";
import { api } from "@/lib/api";
import type { AdminToday } from "@/server/admin";

type Breaker = AdminToday["breaker"];

function describe(breaker: Breaker): { status: string; badge: React.ReactNode } {
  if (breaker.manual) return { status: "Paused from this page. Every AI feature says it's unavailable.", badge: <Badge tone="danger">Paused</Badge> };
  if (breaker.state === "OPEN") {
    return { status: `Opened by itself after ${breaker.failures} failures; tries again after a minute.`, badge: <Badge tone="danger">Open</Badge> };
  }
  if (breaker.state === "HALF_OPEN") return { status: "Letting one call through to test Meta.", badge: <Badge tone="check">Testing</Badge> };
  return { status: "Meta calls are going through.", badge: <Badge tone="success">Running</Badge> };
}

// The manual breaker switch (W-20b): pausing asks first, since owners and
// customers lose every AI feature until it's switched back.
export function BreakerSwitch({ initial }: { initial: Breaker }) {
  const [breaker, setBreaker] = useState(initial);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const titleId = useId();
  const { status, badge } = describe(breaker);

  async function set(open: boolean) {
    setBusy(true);
    setFailed(false);
    try {
      const result = await api<{ breaker: Breaker }>("/api/v1/admin/breaker", { json: { open } });
      setBreaker(result.breaker);
      setAsking(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ListGroup header="AI" footer={status}>
        <ListRow
          icon={<Power />}
          iconTone={breaker.state === "CLOSED" ? "success" : "danger"}
          title="Pause AI"
          titleId={titleId}
          value={badge}
          accessory={
            <Switch
              checked={breaker.manual}
              labelledBy={titleId}
              disabled={busy}
              onCheckedChange={(checked) => (checked ? setAsking(true) : void set(false))}
            />
          }
        />
      </ListGroup>
      {failed && !asking && (
        <p role="alert" className="mx-4 -mt-4 flex items-start gap-2 rounded-md bg-danger-soft px-4 py-3 text-footnote text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          Couldn&apos;t change the switch. Check the connection and try again.
        </p>
      )}
      <AlertDialog
        open={asking}
        onClose={() => setAsking(false)}
        title="Pause all AI?"
        message={
          failed
            ? "Couldn't pause it. Check the connection and try again."
            : "Voice commands, bill photos and customer reviews stop working for everyone until you switch it back."
        }
        cancelLabel="Cancel"
        confirmLabel="Pause AI"
        destructive
        busy={busy}
        onConfirm={() => void set(true)}
      />
    </>
  );
}
