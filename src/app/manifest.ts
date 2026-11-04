import type { MetadataRoute } from "next";

// Makes Shelf Voice installable: Chrome on Android offers "Install app", and
// it opens full screen from the home screen. The Android app (a Trusted Web
// Activity, android/) opens this same site with this manifest's look.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Shelf Voice",
    short_name: "Shelf Voice",
    description: "Speak your shop online, know what to restock, and hear every customer.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // No orientation lock: tablets and desktops get their own layouts.
    // The splash matches the icon's white; the bar matches the app's light background.
    background_color: "#ffffff",
    theme_color: "#f4f5f7",
    lang: "en",
    categories: ["business", "shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the home screen icon.
    shortcuts: [
      { name: "Orders", url: "/app/orders", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Shops near you", short_name: "Nearby shops", url: "/shops", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
