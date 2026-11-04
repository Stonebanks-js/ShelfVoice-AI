// Shelf Voice service worker: shows a notification for each new
// customer order and opens the Orders tab when it's tapped; registered on
// every page so the installed app is a real app. It caches one thing, the
// offline page, shown when a screen can't load without a connection.
const OFFLINE = "/offline.html";
const CACHE = "shelfvoice-offline-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Pages always come from the network; only a failed page load gets the
// offline page. Everything else is left to the browser.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});
self.addEventListener("push", (event) => {
  let data = { title: "Shelf Voice", body: "", url: "/app/orders" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    // A push with no readable body still says something arrived.
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/apple-icon.png",
      badge: "/icon.svg",
      tag: "shelf-voice-order",
      renotify: true,
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/app/orders", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin));
      if (open) return open.navigate(url).then((w) => w?.focus());
      return self.clients.openWindow(url);
    }),
  );
});
