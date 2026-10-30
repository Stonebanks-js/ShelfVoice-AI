"use client";

import { useCallback, useEffect, useRef } from "react";

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  execute(widgetId: string): void;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = SCRIPT;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing"))));
    script.addEventListener("error", () => reject(new Error("turnstile failed to load")));
  });
}

// Cloudflare Turnstile, invisible (doc 03 P2): the widget renders into a
// hidden container and only shows itself if Cloudflare needs the person to
// interact. `token()` runs a fresh challenge each time, since a token can be
// used once.
export function useTurnstile(siteKey: string) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<{ api: TurnstileApi; id: string } | null>(null);
  const pending = useRef<{ resolve: (token: string) => void; reject: (error: Error) => void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then((api) => {
        if (cancelled || !container.current) return;
        const id = api.render(container.current, {
          sitekey: siteKey,
          execution: "execute",
          appearance: "interaction-only",
          callback: (token: string) => pending.current?.resolve(token),
          "error-callback": () => pending.current?.reject(new Error("turnstile error")),
          "expired-callback": () => api.reset(id),
        });
        widget.current = { api, id };
      })
      .catch(() => undefined); // token() reports it when asked
    return () => {
      cancelled = true;
      if (widget.current) widget.current.api.remove(widget.current.id);
      widget.current = null;
    };
  }, [siteKey]);

  const token = useCallback(async (): Promise<string> => {
    if (!widget.current) {
      // The script may still be loading on a slow phone; wait a little.
      for (let i = 0; i < 50 && !widget.current; i++) await new Promise((r) => setTimeout(r, 100));
      if (!widget.current) throw new Error("turnstile unavailable");
    }
    const { api, id } = widget.current;
    api.reset(id);
    return new Promise<string>((resolve, reject) => {
      pending.current = { resolve, reject };
      api.execute(id);
    });
  }, []);

  return { containerRef: container, token };
}
