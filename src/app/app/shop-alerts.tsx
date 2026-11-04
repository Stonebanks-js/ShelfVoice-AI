"use client";

import { EyeOff, MapPinOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useLang } from "@/i18n/lang";
import { api } from "@/lib/api";
import { errorKey } from "@/lib/errors";

// What stops customers finding the shop, at the top of Home. Testers
// set shops up and never saw them in Shops near you: a new shop stays hidden
// until its owner shows it, and one without a location never appears on the
// map or in a search by location. Each alert carries the one action that
// fixes it.
export function ShopAlerts({ id, published, hasProducts, hasLocation }: { id: string; published: boolean; hasProducts: boolean; hasLocation: boolean }) {
  const { t } = useLang();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function show() {
    setBusy(true);
    try {
      await api(`/api/v1/shops/${id}/publish`, { json: { published: true } });
      toast.show({ message: t("home.publishedNow") });
      router.refresh();
    } catch (failure) {
      toast.show({ message: t(errorKey(failure)) });
    } finally {
      setBusy(false);
    }
  }

  // An empty shop's next step is the shop card's Build button, not this.
  const hidden = !published && hasProducts;
  if (!hidden && hasLocation) return null;
  return (
    <div className="mx-4 flex flex-col gap-3">
      {hidden && (
        <Alert icon={<EyeOff />} title={t("home.alert.hidden")} body={t("home.alert.hiddenBody")}>
          <Button loading={busy} onClick={show}>
            {t("home.publish")}
          </Button>
        </Alert>
      )}
      {!hasLocation && (
        <Alert icon={<MapPinOff />} title={t("home.alert.noLocation")} body={t("home.alert.noLocationBody")}>
          <ButtonLink href="/app/shop?open=details" variant="tinted">
            {t("home.alert.addLocation")}
          </ButtonLink>
        </Alert>
      )}
    </div>
  );
}

function Alert({ icon, title, body, children }: { icon: ReactNode; title: string; body: string; children: ReactNode }) {
  return (
    <section role="status" className="flex flex-col gap-3 rounded-xl bg-warn-soft p-4 sm:flex-row sm:items-center">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-warn [&>svg]:size-5">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body font-semibold text-ink">{title}</span>
        <span className="text-footnote text-ink-2">{body}</span>
      </span>
      <span className="shrink-0">{children}</span>
    </section>
  );
}
