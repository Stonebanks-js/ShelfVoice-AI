"use client";

import { Download, Share } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { ListRow } from "@/components/ui/list";
import { useLang } from "@/i18n/lang";

// Installing Shelf Voice as an app (E-37). Chrome's "Add to home screen"
// can make a plain shortcut that opens in a browser tab; the install prompt
// it offers once the page qualifies makes a real app window instead. This
// keeps that prompt for an "Install app" button, and registers the service
// worker on every page so the installed app opens even when offline.

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Mounted once in the root layout.
export function AppInstall() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    const onPrompt = (event: Event) => {
      event.preventDefault(); // shown from our button instead of a mini bar
      deferred = event as InstallPromptEvent;
      notify();
    };
    const onInstalled = () => {
      deferred = null;
      notify();
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}

const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
const platformNow = () => (standalone() ? "installed" : isIos() ? "ios" : "other");

// "prompt" when Chrome can install now, "ios" on Safari (Share > Add to Home
// Screen), null when already installed or the browser can't.
export function useInstall() {
  const ready = useSyncExternalStore(subscribe, () => deferred !== null, () => false);
  const platform = useSyncExternalStore(subscribe, platformNow, () => "other" as const);
  const mode = platform === "installed" ? null : ready ? "prompt" : platform === "ios" ? "ios" : null;
  const install = async () => {
    if (!deferred) return;
    const event = deferred;
    deferred = null;
    notify();
    await event.prompt();
  };
  return { mode, install };
}

// A settings row: "Install app", or how to on an iPhone. Nothing once installed.
export function InstallAppRow() {
  const { t } = useLang();
  const { mode, install } = useInstall();
  const [iosHelp, setIosHelp] = useState(false);
  if (!mode) return null;
  return (
    <ListRow
      icon={mode === "ios" ? <Share /> : <Download />}
      title={t("install.title")}
      subtitle={mode === "ios" && iosHelp ? t("install.ios") : t("install.body")}
      onClick={mode === "prompt" ? () => void install() : () => setIosHelp(true)}
      wrap
    />
  );
}
