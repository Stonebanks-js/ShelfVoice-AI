"use client";

import { MicButton } from "@/components/shell/mic-button";
import { TabBar } from "@/components/shell/tab-bar";

// The live tab bar. The mic records once F-03 lands; until then it is the
// same button in its idle state.
export function OwnerTabBar() {
  return <TabBar mic={<MicButton state="idle" />} />;
}
