"use client";

import { usePathname, useRouter } from "next/navigation";

import { TabBar } from "@/components/shell/tab-bar";
import { VoiceCapture } from "@/components/shell/voice-capture";
import { submitVoice } from "@/lib/voice";

// Screens with their own bottom actions hide the tab bar.
const FULL_SCREEN = ["/app/check/", "/app/setup", "/app/camera"];

// The live tab bar. The centre mic records a 30-second command (doc 06),
// turns it into proposed changes, and opens Check and confirm.
export function OwnerTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  if (FULL_SCREEN.some((prefix) => pathname.startsWith(prefix))) return null;
  return (
    <TabBar
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
