// Interface text in English and Hindi (doc 06 U2, errata E-21: the interface
// is Hindi or English; AI replies may be Hinglish). Plain everyday words,
// never system terms like "proposal" or "SKU".
export type Lang = "en" | "hi";
export const LANGS: Lang[] = ["en", "hi"];

const en = {
  "app.name": "Shelf Voice",
  "app.tagline": "Speak your shop online, know what to restock, hear every customer.",

  "tab.today": "Today",
  "tab.stock": "Stock",
  "tab.orders": "Orders",
  "tab.reviews": "Reviews",
  "tab.label": "Main sections",

  "mic.label": "Speak",
  "mic.idle": "Tap to speak",
  "mic.recording": "Recording, tap to stop",
  "mic.stop": "Stop",
  "mic.processing": "Understanding…",
  "mic.paused": "Voice is resting for now. You can still edit by tapping.",

  "action.confirmAll": "Confirm all",
  "action.cancel": "Cancel",
  "action.done": "Done",
  "action.edit": "Edit",
  "action.remove": "Remove",
  "action.undo": "Undo",
  "action.retry": "Try again",
  "action.save": "Save",
  "action.delete": "Delete",
  "action.share": "Share",

  "search.placeholder": "Search products",
  "search.clear": "Clear search",

  "status.inStock": "In stock",
  "status.outOfStock": "Out of stock",
  "status.low": "Running low",
  "status.check": "Please check",
  "status.new": "New",
  "status.loading": "Loading",
  "status.offline": "You're offline. Your changes will wait.",

  "toast.saved": "{n} changes saved",

  "empty.stock.title": "No products yet",
  "empty.stock.body": "Tap the mic and say what you sell.",

  "lang.label": "Language",
  "theme.label": "Appearance",
  "theme.phone": "Phone",
  "theme.light": "Light",
  "theme.dark": "Dark",

  "signin.google": "Continue with Google",
  "signin.demo": "Try the demo shop",
  "signin.demoNote": "No sign-up. A sample kirana shop, yours for 24 hours.",
  "signin.voice.title": "Speak to set up your shop",
  "signin.voice.body": "Say what you sell. We build your shop page.",
  "signin.restock.title": "Know what to restock",
  "signin.restock.body": "A daily order list from your own sales.",
  "signin.reviews.title": "Hear every customer",
  "signin.reviews.body": "Customers leave voice reviews from a QR code.",
  "signin.failed": "Sign-in didn't finish. Please try again.",

  "welcome.title": "Choose your language",
  "welcome.body": "The app will talk to you in this language. You can change it later in My shop.",
  "action.continue": "Continue",

  "error.rateLimited": "Too many tries. Please wait a little and try again.",
  "error.demoUnavailable": "The demo shop isn't available right now. Please try again soon.",
  "error.signedOut": "Please sign in again.",
  "error.generic": "Something went wrong. Please try again.",
  "error.offline": "You're offline. Check your internet and try again.",

  "soon.title": "Coming next",
  "soon.body": "This screen is being built. Everything else keeps working.",
};

export type MessageKey = keyof typeof en;

const hi: Record<MessageKey, string> = {
  "app.name": "शेल्फ़ वॉइस",
  "app.tagline": "बोलकर दुकान ऑनलाइन करें, जानें क्या मँगवाना है, हर ग्राहक की सुनें।",

  "tab.today": "आज",
  "tab.stock": "स्टॉक",
  "tab.orders": "ऑर्डर",
  "tab.reviews": "रिव्यू",
  "tab.label": "मुख्य हिस्से",

  "mic.label": "बोलो",
  "mic.idle": "बोलने के लिए दबाएँ",
  "mic.recording": "रिकॉर्ड हो रहा है, रोकने के लिए दबाएँ",
  "mic.stop": "रोको",
  "mic.processing": "समझ रहे हैं…",
  "mic.paused": "आवाज़ अभी आराम कर रही है। आप छूकर बदलाव कर सकते हैं।",

  "action.confirmAll": "सब पक्का करो",
  "action.cancel": "रद्द करो",
  "action.done": "हो गया",
  "action.edit": "बदलो",
  "action.remove": "हटाओ",
  "action.undo": "वापस लो",
  "action.retry": "फिर से कोशिश करो",
  "action.save": "सेव करो",
  "action.delete": "मिटाओ",
  "action.share": "शेयर करो",

  "search.placeholder": "सामान खोजें",
  "search.clear": "खोज साफ़ करें",

  "status.inStock": "स्टॉक में",
  "status.outOfStock": "स्टॉक ख़त्म",
  "status.low": "कम बचा है",
  "status.check": "कृपया जाँचें",
  "status.new": "नया",
  "status.loading": "लोड हो रहा है",
  "status.offline": "आप ऑफ़लाइन हैं। आपके बदलाव इंतज़ार करेंगे।",

  "toast.saved": "{n} बदलाव सेव हुए",

  "empty.stock.title": "अभी कोई सामान नहीं",
  "empty.stock.body": "माइक दबाइए और बताइए आप क्या बेचते हैं।",

  "lang.label": "भाषा",
  "theme.label": "रूप",
  "theme.phone": "फ़ोन जैसा",
  "theme.light": "हल्का",
  "theme.dark": "गहरा",

  "signin.google": "Google से आगे बढ़ें",
  "signin.demo": "डेमो दुकान देखें",
  "signin.demoNote": "साइन-अप नहीं चाहिए। एक नमूना किराना दुकान, 24 घंटे आपकी।",
  "signin.voice.title": "बोलकर दुकान सेट करें",
  "signin.voice.body": "बताइए आप क्या बेचते हैं। हम आपकी दुकान का पेज बना देंगे।",
  "signin.restock.title": "जानें क्या मँगवाना है",
  "signin.restock.body": "आपकी अपनी बिक्री से रोज़ की ऑर्डर लिस्ट।",
  "signin.reviews.title": "हर ग्राहक की सुनें",
  "signin.reviews.body": "ग्राहक QR कोड से आवाज़ में रिव्यू देते हैं।",
  "signin.failed": "साइन-इन पूरा नहीं हुआ। फिर से कोशिश करें।",

  "welcome.title": "अपनी भाषा चुनें",
  "welcome.body": "ऐप आपसे इसी भाषा में बात करेगा। इसे बाद में \"मेरी दुकान\" में बदल सकते हैं।",
  "action.continue": "आगे बढ़ें",

  "error.rateLimited": "बहुत बार कोशिश हुई। थोड़ी देर बाद फिर करें।",
  "error.demoUnavailable": "डेमो दुकान अभी उपलब्ध नहीं है। थोड़ी देर में फिर कोशिश करें।",
  "error.signedOut": "कृपया फिर से साइन-इन करें।",
  "error.generic": "कुछ गड़बड़ हुई। फिर से कोशिश करें।",
  "error.offline": "आप ऑफ़लाइन हैं। इंटरनेट देखकर फिर कोशिश करें।",

  "soon.title": "जल्द आ रहा है",
  "soon.body": "यह स्क्रीन बन रही है। बाकी सब चलता रहेगा।",
};

const dictionaries: Record<Lang, Record<MessageKey, string>> = { en, hi };

// Looks up a message and fills {name} placeholders.
export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string {
  const text = dictionaries[lang][key];
  return vars ? text.replace(/\{(\w+)\}/g, (match, name: string) => String(vars[name] ?? match)) : text;
}

// Doc 06 U2: follow the phone's language; Hindi when it prefers Hindi.
export function langFromAcceptLanguage(header: string | null | undefined): Lang {
  const first = header?.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("hi") ? "hi" : "en";
}
