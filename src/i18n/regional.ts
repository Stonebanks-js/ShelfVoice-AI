import type { Messages, RegionalLang } from "./dictionary";

// Each regional language is its own chunk: a page downloads only the one in use.
export const loadMessages: Record<RegionalLang, () => Promise<{ default: Messages }>> = {
  kn: () => import("./locales/kn"),
  ta: () => import("./locales/ta"),
  te: () => import("./locales/te"),
  ml: () => import("./locales/ml"),
  mr: () => import("./locales/mr"),
  gu: () => import("./locales/gu"),
  bn: () => import("./locales/bn"),
  or: () => import("./locales/or"),
  pa: () => import("./locales/pa"),
};
