"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { TabBar } from "@/components/shell/tab-bar";
import { VoiceCapture } from "@/components/shell/voice-capture";
import { cn } from "@/lib/cn";
import { submitVoice } from "@/lib/voice";

// Screens with their own bottom actions hide the tab bar.
const FULL_SCREEN = ["/app/check/", "/app/setup", "/app/camera", "/app/add/"];

const fullScreen = (pathname: string) => FULL_SCREEN.some((prefix) => pathname.startsWith(prefix));

// The screen area: room for the bottom bar on a phone, and beside the
// sidebar from 1024 px (E-37).
export function OwnerMain({ withBar, children }: { withBar: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const bar = withBar && !fullScreen(pathname);
  return (
    <div className={cn("flex min-h-dvh flex-col", bar && "pb-[calc(env(safe-area-inset-bottom)+6rem)] lg:pb-8 lg:pl-64")}>
      {children}
    </div>
  );
}

// The live tab bar. The centre mic records a 30-second command (doc 06),
// turns it into proposed changes, and opens Check and confirm.
export function OwnerTabBar({ shop }: { shop: { name: string; slug: string } }) {
  const router = useRouter();
  const pathname = usePathname();
  if (fullScreen(pathname)) return null;
  return (
    <TabBar
      shop={shop}
      mic={
        <VoiceCapture
          maxSeconds={30}
          queueAs="COMMAND"
          onUploaded={async (path) => {
            const id = await submitVoice(path, "COMMAND");
            router.push(`/app/check/${id}`);
          }}
        />
      }
    />
  );
}
