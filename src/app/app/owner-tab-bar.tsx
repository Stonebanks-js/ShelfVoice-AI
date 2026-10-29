"use client";

import { VoiceCapture } from "@/components/shell/voice-capture";
import { TabBar } from "@/components/shell/tab-bar";
import { useToast } from "@/components/ui/toast";
import { useLang } from "@/i18n/lang";

// The live tab bar. The centre mic records a 30-second command (doc 06) and
// uploads it; F-04 turns the stored clip into changes to check and confirm.
export function OwnerTabBar() {
  const toast = useToast();
  const { t } = useLang();
  return <TabBar mic={<VoiceCapture maxSeconds={30} onUploaded={() => toast.show({ message: t("mic.saved") })} />} />;
}
