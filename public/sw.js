// ALACARTE · Kapalı Yerel Ağ (LAN) Garson Mobil El Terminali Service Worker (PWA)
const CACHE_NAME = "alacarte-lan-pwa-v3";
const SHELL_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/manifest.json",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/apple-touch-icon.png",
  "/icon.svg",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => {
        // Ignore individual asset cache errors during install
      })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((oldKey) => caches.delete(oldKey))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Health endpoint always goes directly to local server
  if (url.pathname.startsWith("/api/health")) {
    return;
  }

  // Static icons and manifest: Cache-first, fallback to network
  if (
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith("manifest.json") ||
    url.pathname.endsWith("manifest.webmanifest")
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, copy));
            return response;
          })
      )
    );
    return;
  }

  // App pages & Next.js chunks: Network-first on Closed LAN, fallback to cached shell if Wi-Fi momentarily drops
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const rootShell = await caches.match("/");
        if (rootShell) return rootShell;
        return new Response(
          `<!doctype html><html lang="tr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>ALACARTE · Kapalı LAN Bağlantısı Bekleniyor</title><style>body{margin:0;background:#101819;color:#f0f5f3;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;padding:24px;text-align:center}.card{max-width:400px;background:#192526;border:1px solid #344647;border-radius:18px;padding:24px}.btn{margin-top:16px;padding:12px 20px;border-radius:10px;border:none;background:#73d8c6;color:#10201e;font-weight:800;cursor:pointer}</style></head><body><div class="card"><h2>⚠️ Restoran Kapalı LAN Bağlantısı Kesildi</h2><p>Garson el terminaliniz yerel sunucuya (Tiwox TP-8610 / Archer AX23 Wi-Fi) şu anda ulaşamıyor. Lütfen restoran Wi-Fi kapsama alanına dönüp tekrar deneyin.</p><button class="btn" onclick="location.reload()">Yeniden Bağlan</button></div></body></html>`,
          {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }
        );
      })
  );
});

self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data.type === "SHOW_WAITER_NOTIFICATION") {
    const title = event.data.title || "ALACARTE · Garson Bildirimi";
    const options = {
      body: event.data.body || "Masa operasyon durumu güncellendi.",
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      vibrate: [120, 60, 120],
      tag: event.data.tag || "alacarte-waiter-alert",
      data: {
        url: event.data.url || "/?pwa=1&mode=waiter",
      },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "ALACARTE POS", body: event.data.text() };
  }
  const options = {
    body: data.body || "Yeni operasyon bildirimi",
    icon: data.icon || "/icon-192x192.png",
    badge: "/icon-192x192.png",
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      url: data.url || "/?pwa=1&mode=waiter",
    },
  };
  event.waitUntil(
    self.registration.showNotification(data.title || "ALACARTE POS", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/?pwa=1&mode=waiter";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
