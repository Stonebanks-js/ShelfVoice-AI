import "server-only";

import { isRegional, registerMessages, type Lang, type Messages, type RegionalLang } from "./dictionary";
import bn from "./locales/bn";
import gu from "./locales/gu";
import kn from "./locales/kn";
import ml from "./locales/ml";
import mr from "./locales/mr";
import or from "./locales/or";
import pa from "./locales/pa";
import ta from "./locales/ta";
import te from "./locales/te";

// On the server every language is ready, so server-rendered text (Home,
// change cards) uses it, and pages hand the current one to the browser.
const ALL: Record<RegionalLang, Messages> = { kn, ta, te, ml, mr, gu, bn, or, pa };
for (const [lang, messages] of Object.entries(ALL)) registerMessages(lang as RegionalLang, messages);

export const messagesFor = (lang: Lang): Messages | undefined => (isRegional(lang) ? ALL[lang] : undefined);
