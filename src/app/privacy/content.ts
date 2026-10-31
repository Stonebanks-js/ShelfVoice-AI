import type { Lang } from "@/i18n/dictionary";

// The privacy page's words (F-14; doc 03 data inventory, errata E-08, E-12,
// E-28). Each "how long" must match the cleanup job and the delete-shop
// function; change them together.

export const ISSUES_URL = "https://github.com/Stonebanks-js/ShelfVoice-AI/issues";
export const UPDATED = "2026-10-31";

export interface Kept {
  what: string;
  detail: string;
  keep: string;
}

export interface PrivacyContent {
  title: string;
  updated: string;
  intro: string;
  keepLabel: string;
  where: { title: string; body: string[] };
  owners: { title: string; rows: Kept[] };
  customers: { title: string; rows: Kept[] };
  ai: { title: string; body: string[] };
  services: { title: string; rows: Array<{ what: string; detail: string }> };
  cookies: { title: string; body: string[] };
  deleting: { title: string; body: string[] };
  contact: { title: string; body: string; link: string; warning: string };
}

const en: PrivacyContent = {
  title: "Privacy",
  updated: "Updated 31 October 2026",
  keepLabel: "How long",
  intro:
    "Shelf Voice helps kirana shop owners run their shop by voice, and lets their customers leave a voice review. This page says what we keep, where it is stored and when it is deleted.",
  where: {
    title: "Where your data is stored",
    body: [
      "Everything we keep is stored with Supabase in Seoul, South Korea. It is not stored in India.",
      "The app itself runs on Vercel servers in Mumbai, India, which pass data to and from Seoul.",
    ],
  },
  owners: {
    title: "If you run a shop",
    rows: [
      { what: "Your Google account", detail: "Your email address and the name Google shares, so you can sign in.", keep: "Until you delete your shop" },
      { what: "Your shop", detail: "Name, address, phone, hours, products, prices, and the stock and sales you record.", keep: "Until you delete your shop" },
      { what: "Voice notes", detail: "What you say to the app. The words we understood stay with each change you confirm.", keep: "Audio 7 days, words 90 days" },
      { what: "Bill and shelf photos", detail: "Your phone removes the photo's location and camera details before it is sent.", keep: "30 days" },
      { what: "The demo shop", detail: "A copy only you can see, with no account.", keep: "24 hours" },
    ],
  },
  customers: {
    title: "If you visit a shop or leave a review",
    rows: [
      { what: "Shop pages", detail: "Open without an account. We keep nothing about who looked.", keep: "Nothing kept" },
      { what: "Voice reviews", detail: "Your recording, the words we understood, whether you sounded happy, and the items you mentioned. The shop can hide a review from its page. Please don't say your name or phone number. For adults 18 and over.", keep: "Audio 30 days, words until the shop is deleted" },
      { what: "Your internet address", detail: "Never stored as it is. A scrambled code that changes every day is used to stop spam.", keep: "7 days" },
    ],
  },
  ai: {
    title: "How AI is used",
    body: [
      "Voice notes, review recordings and photos are sent to Meta's AI models (Muse Spark and Voice Transcribe) only to turn speech into words and photos into product changes. No other AI company receives them.",
      "The AI only suggests. Every change to a shop is shown to its owner first, and stock counts, prices and reorder amounts are worked out by our own code.",
    ],
  },
  services: {
    title: "Other services we use",
    rows: [
      { what: "Google", detail: "Sign-in for shop owners." },
      { what: "Cloudflare Turnstile", detail: "Checks that a review comes from a person, not a bot, on the review page only." },
      { what: "Axiom", detail: "Error and speed logs. They hold the page and the error, never voice, words, names or phone numbers, and are kept up to 30 days." },
    ],
  },
  cookies: {
    title: "Cookies",
    body: [
      "Shop owners get a sign-in cookie. Everyone gets a cookie that remembers Hindi or English for a year.",
      "There are no advertising or tracking cookies, and no ads.",
    ],
  },
  deleting: {
    title: "Deleting your data",
    body: [
      "Shop owners: open My shop and tap Delete my shop. Your shop, products, history, reviews, recordings, photos and account are deleted straight away. Anything left over is removed within 24 hours.",
      "Customers: ask the shop to hide your review, or write to us below with the shop's name and roughly when you left it.",
    ],
  },
  contact: {
    title: "Contact",
    body: "Questions or deletion requests go to the project's issue page on GitHub.",
    link: "Open an issue on GitHub",
    warning: "Issues are public. Don't write your phone number, address or anything private there.",
  },
};

const hi: PrivacyContent = {
  title: "गोपनीयता",
  updated: "31 अक्टूबर 2026 को अपडेट किया गया",
  keepLabel: "कब तक",
  intro:
    "Shelf Voice किराना दुकानदारों को आवाज़ से दुकान चलाने में मदद करता है, और उनके ग्राहकों को आवाज़ में रिव्यू देने देता है। यह पेज बताता है कि हम क्या रखते हैं, कहाँ रखते हैं और कब मिटाते हैं।",
  where: {
    title: "आपका डेटा कहाँ रखा जाता है",
    body: [
      "हम जो कुछ भी रखते हैं, वह Supabase के पास सियोल, दक्षिण कोरिया में रखा जाता है। यह भारत में नहीं रखा जाता।",
      "ऐप खुद मुंबई, भारत में Vercel के सर्वर पर चलता है, जो डेटा को सियोल तक लाते और ले जाते हैं।",
    ],
  },
  owners: {
    title: "अगर आप दुकान चलाते हैं",
    rows: [
      { what: "आपका Google खाता", detail: "आपका ईमेल और Google जो नाम देता है, ताकि आप साइन इन कर सकें।", keep: "दुकान मिटाने तक" },
      { what: "आपकी दुकान", detail: "नाम, पता, फ़ोन, समय, सामान, दाम, और आपके दर्ज किए स्टॉक और बिक्री।", keep: "दुकान मिटाने तक" },
      { what: "वॉइस नोट", detail: "आप ऐप से जो बोलते हैं। हमने जो शब्द समझे, वे आपके हर पक्के किए बदलाव के साथ रहते हैं।", keep: "आवाज़ 7 दिन, शब्द 90 दिन" },
      { what: "बिल और शेल्फ़ की फ़ोटो", detail: "भेजने से पहले आपका फ़ोन फ़ोटो से जगह और कैमरे की जानकारी हटा देता है।", keep: "30 दिन" },
      { what: "डेमो दुकान", detail: "एक कॉपी जो सिर्फ़ आप देख सकते हैं, बिना खाते के।", keep: "24 घंटे" },
    ],
  },
  customers: {
    title: "अगर आप दुकान देखते हैं या रिव्यू देते हैं",
    rows: [
      { what: "दुकान के पेज", detail: "बिना खाते के खुलते हैं। किसने देखा, इसके बारे में हम कुछ नहीं रखते।", keep: "कुछ नहीं रखा जाता" },
      { what: "आवाज़ वाले रिव्यू", detail: "आपकी रिकॉर्डिंग, हमने जो शब्द समझे, आप खुश लगे या नहीं, और आपने जिन सामानों का ज़िक्र किया। दुकान किसी रिव्यू को अपने पेज से छिपा सकती है। कृपया अपना नाम या फ़ोन नंबर न बोलें। सिर्फ़ 18 साल और उससे बड़े लोगों के लिए।", keep: "आवाज़ 30 दिन, शब्द दुकान मिटने तक" },
      { what: "आपका इंटरनेट पता", detail: "जैसा है वैसा कभी नहीं रखा जाता। स्पैम रोकने के लिए एक बदला हुआ कोड इस्तेमाल होता है, जो हर दिन बदलता है।", keep: "7 दिन" },
    ],
  },
  ai: {
    title: "AI का इस्तेमाल कैसे होता है",
    body: [
      "वॉइस नोट, रिव्यू की रिकॉर्डिंग और फ़ोटो Meta के AI मॉडल (Muse Spark और Voice Transcribe) को सिर्फ़ इसलिए भेजे जाते हैं ताकि बोली को शब्दों में और फ़ोटो को सामान के बदलावों में बदला जा सके। किसी और AI कंपनी को ये नहीं भेजे जाते।",
      "AI सिर्फ़ सुझाव देता है। दुकान में हर बदलाव पहले दुकानदार को दिखाया जाता है, और स्टॉक की गिनती, दाम और कितना मँगाना है, यह हमारा अपना कोड तय करता है।",
    ],
  },
  services: {
    title: "हम और कौन सी सेवाएँ इस्तेमाल करते हैं",
    rows: [
      { what: "Google", detail: "दुकानदारों के साइन इन के लिए।" },
      { what: "Cloudflare Turnstile", detail: "सिर्फ़ रिव्यू वाले पेज पर, यह जाँचने के लिए कि रिव्यू किसी इंसान ने दिया है, बॉट ने नहीं।" },
      { what: "Axiom", detail: "गड़बड़ी और स्पीड के लॉग। इनमें पेज और गड़बड़ी होती है, कभी आवाज़, शब्द, नाम या फ़ोन नंबर नहीं, और ये ज़्यादा से ज़्यादा 30 दिन रखे जाते हैं।" },
    ],
  },
  cookies: {
    title: "कुकी",
    body: [
      "दुकानदारों को साइन इन के लिए एक कुकी मिलती है। सबको एक कुकी मिलती है जो एक साल तक याद रखती है कि आपने हिन्दी चुनी या English।",
      "कोई विज्ञापन या ट्रैकिंग कुकी नहीं है, और कोई विज्ञापन नहीं।",
    ],
  },
  deleting: {
    title: "अपना डेटा मिटाना",
    body: [
      "दुकानदार: मेरी दुकान खोलें और मेरी दुकान मिटाएँ दबाएँ। आपकी दुकान, सामान, रिकॉर्ड, रिव्यू, रिकॉर्डिंग, फ़ोटो और खाता तुरंत मिटा दिए जाते हैं। जो कुछ बचा रह जाए, वह 24 घंटे में हट जाता है।",
      "ग्राहक: दुकान से अपना रिव्यू छिपाने को कहें, या नीचे दिए पते पर दुकान का नाम और लगभग कब रिव्यू दिया था, लिखकर भेजें।",
    ],
  },
  contact: {
    title: "संपर्क",
    body: "सवाल या डेटा मिटाने की माँग GitHub पर प्रोजेक्ट के इश्यू पेज पर भेजें।",
    link: "GitHub पर इश्यू खोलें",
    warning: "इश्यू सबको दिखते हैं। वहाँ अपना फ़ोन नंबर, पता या कोई निजी बात न लिखें।",
  },
};

export const PRIVACY: Record<Lang, PrivacyContent> = { en, hi };
