"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { translate, type Lang, type MessageKey } from "./dictionary";

const LANG_COOKIE = "sv_lang";

interface LangContext {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const Context = createContext<LangContext | null>(null);

// Holds the interface language and marks its subtree with the right `lang`
// so screen readers pronounce Hindi correctly (doc 06). The choice is kept in
// a cookie so server-rendered pages can start in it.
export function LangProvider({ initial, children }: { initial: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);
  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }, []);
  const value = useMemo<LangContext>(
    () => ({ lang, setLang, t: (key, vars) => translate(lang, key, vars) }),
    [lang, setLang],
  );
  return (
    <Context value={value}>
      <div lang={lang} className="contents">
        {children}
      </div>
    </Context>
  );
}

export function useLang(): LangContext {
  const context = useContext(Context);
  if (!context) throw new Error("useLang must be used inside <LangProvider>");
  return context;
}
