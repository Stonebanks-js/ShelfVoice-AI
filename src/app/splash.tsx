"use client";

import { useEffect, useState } from "react";

import { LogoMark } from "@/components/brand/logo";

const SEEN = "sv_splash_seen";
const SHOW_MS = 2500;

// The opening screen (V-10, testers on Nov 3): the logo on the brand's red,
// its voice bars moving, for about 2.5 s on the first open of a session. It
// also covers the page settling in, which testers saw as a jump. Skipped when
// the phone asks for reduced motion or the session has seen it already.
export function Splash() {
  const [state, setState] = useState<"show" | "leaving" | "gone">("show");

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN) === "1";
      sessionStorage.setItem(SEEN, "1");
    } catch {
      // Private mode: show it once per page load instead.
    }
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (seen || still) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the browser
      setState("gone");
      return;
    }
    const leave = window.setTimeout(() => setState("leaving"), SHOW_MS);
    const gone = window.setTimeout(() => setState("gone"), SHOW_MS + 400);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(gone);
    };
  }, []);

  if (state === "gone") return null;
  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[100] grid place-items-center bg-accent-fill transition-opacity duration-400 ${state === "leaving" ? "opacity-0" : "opacity-100"}`}
    >
      <div className="flex flex-col items-center gap-5">
        <span className="grid size-28 animate-[splash-in_600ms_cubic-bezier(0.22,1,0.36,1)_both] place-items-center rounded-[2rem] bg-surface shadow-float">
          <LogoMark className="h-16 w-auto text-ink" cut="stroke-surface" />
        </span>
        <span className="font-display text-[2rem] leading-none font-bold tracking-tight text-on-accent">Shelf Voice</span>
        <span className="flex h-6 items-center gap-1.5" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="w-1.5 animate-[splash-bar_900ms_ease-in-out_infinite] rounded-full bg-on-accent/80" style={{ animationDelay: `${i * 110}ms`, height: "100%" }} />
          ))}
        </span>
      </div>
    </div>
  );
}
