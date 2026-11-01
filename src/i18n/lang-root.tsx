import type { ReactNode } from "react";

import type { Lang } from "./dictionary";
import { LangProvider } from "./lang";
import { messagesFor } from "./server";

// Server pages start the browser in a language with its text already there,
// so a regional page never flashes English first.
export function LangRoot({ initial, children }: { initial: Lang; children: ReactNode }) {
  return (
    <LangProvider initial={initial} messages={messagesFor(initial)}>
      {children}
    </LangProvider>
  );
}
