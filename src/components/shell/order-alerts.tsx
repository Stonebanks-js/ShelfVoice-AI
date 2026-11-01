"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useLang } from "@/i18n/lang";
import { api } from "@/lib/api";
import { errorKey } from "@/lib/errors";

const noSubscribe = () => () => undefined;
const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const keyBytes = (base64url: string) => {
  const raw = atob(base64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64url.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

// "Get a notification for each new order": registers the service worker and
// a push subscription for this phone (web push; no app to install).
export function OrderAlerts({ vapidKey, plain = false }: { vapidKey: string; plain?: boolean }) {
  const { t } = useLang();
  const toast = useToast();
  const supported = useSyncExternalStore(noSubscribe, pushSupported, () => false);
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!supported) return;
    let live = true;
    navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => live && setOn(Boolean(sub)))
      .catch(() => live && setOn(false));
    return () => {
      live = false;
    };
  }, [supported]);

  if (!supported || on === null) return null;

  async function turnOn() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setDenied(true);
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey) });
      await api("/api/v1/push-subscriptions", { json: sub.toJSON() });
      setOn(true);
    } catch (failure) {
      toast.show({ message: t(errorKey(failure)) });
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api("/api/v1/push-subscriptions", { method: "DELETE", json: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setOn(false);
    } catch (failure) {
      toast.show({ message: t(errorKey(failure)) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={plain ? "flex flex-col gap-2 px-4 py-3" : "mx-4 flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-card"}>
      {on ? (
        <div className="flex items-center gap-3">
          <Bell aria-hidden className="size-5 shrink-0" />
          <span className="flex-1 text-body">{t("orders.alertsOn")}</span>
          <Button variant="plain" loading={busy} onClick={turnOff} icon={<BellOff aria-hidden className="size-5" />}>
            {t("orders.alertsOff")}
          </Button>
        </div>
      ) : (
        <Button variant="tinted" loading={busy} onClick={turnOn} icon={<Bell aria-hidden className="size-5" />}>
          {t("orders.alerts")}
        </Button>
      )}
      {denied && (
        <p role="alert" className="text-footnote text-danger">
          {t("orders.alertsDenied")}
        </p>
      )}
    </div>
  );
}
