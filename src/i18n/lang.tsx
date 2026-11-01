"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { hasMessages, isRegional, registerMessages, translate, type Lang, type MessageKey, type Messages } from "./dictionary";
import { loadMessages } from "./regional";

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
// A regional language's text arrives with the page (`messages`, from
// LangRoot); switching to another loads its chunk first.
export function LangProvider({ initial, messages, children }: { initial: Lang; messages?: Messages; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (messages && !hasMessages(initial)) registerMessages(initial, messages);
    return initial;
  });
  const setLang = useCallback((next: Lang) => {
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    if (!isRegional(next) || hasMessages(next)) return setLangState(next);
    void loadMessages[next]()
      .then((loaded) => {
        registerMessages(next, loaded.default);
        setLangState(next);
      })
      .catch(() => setLangState(next)); // offline: English text until the next load
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
