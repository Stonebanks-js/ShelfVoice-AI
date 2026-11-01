// Shelf Voice service worker (V-04): shows a notification for each new
// customer order, and opens the Orders tab when it's tapped. Nothing else:
// no caching, no offline pages.
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
