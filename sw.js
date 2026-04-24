// =============================================================================
// SiteLog v3.0 — Service Worker (offline‑optimized)
// =============================================================================

const CACHE_NAME = 'sitelog-v3.1';   // ⚠️ άλλαξε όνομα για να χτιστεί νέα cache
const PRECACHE_URLS = [
  // ── Δικές σου σελίδες & assets (είναι πάντα διαθέσιμα) ──
  'index.html',
  'login.html',
  'scanner.html',
  'attendance.html',
  'workers.html',
  'qr-generator.html',
  'reports.html',
  'sepe-report.html',
  'site-diary.html',
  'admin-adhoc-queue.html',
  'admin-company-worker-edit.html',
  'admin-company-workers.html',
  'admin-settings.html',
  'admin-site-edit.html',
  'admin-sites.html',
  'admin-users.html',
  'set-password.html',

  'shared/theme.css',
  'shared/auth.js',
  'shared/toast.js',
  'shared/offline-sync.js',

  'manifest.json',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',

  // Google Fonts μπορεί να μείνει (συνήθως λειτουργεί)
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap',
];

// ── Εγκατάσταση ──────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Precaching…');
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('[SW] Κάποια precache απέτυχαν, αλλά συνεχίζω', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Ενεργοποίηση ─────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

// ── Διαχείριση αιτημάτων ─────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Επιτρέπουμε μόνο τα δικά μας origins + CDN που χρησιμοποιούμε
  if (!url.origin.startsWith(self.location.origin) &&
      !url.href.startsWith('https://fonts.googleapis.com') &&
      !url.href.startsWith('https://fonts.gstatic.com') &&
      !url.href.startsWith('https://cdn.jsdelivr.net') &&
      !url.href.startsWith('https://unpkg.com') &&
      !url.href.startsWith('https://cdnjs.cloudflare.com') &&
      !url.href.startsWith('https://www.dropbox.com') &&
      !url.href.startsWith('https://ikmwxsfaopjkgajebyyf.supabase.co')) {
    return; // Δεν διαχειριζόμαστε άλλα domains
  }

  // Supabase API – πάντα online
  if (url.hostname === 'ikmwxsfaopjkgajebyyf.supabase.co') {
    event.respondWith(fetch(request).catch(() => new Response('{}', {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // Για όλα τα άλλα: Cache First (πρώτα κοιτάμε στην cache, αλλιώς δίκτυο)
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) {
        // Επιστρέφουμε την cached έκδοση και στο παρασκήνιο ανανεώνουμε
        const fetchPromise = fetch(request).then(networkResponse => {
          if (networkResponse.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(request, networkResponse.clone()));
          }
          return networkResponse;
        }).catch(() => {});
        return cachedResponse;
      }
      // Αν δεν υπάρχει στην cache, φορτώνουμε από δίκτυο και το αποθηκεύουμε
      return fetch(request).then(networkResponse => {
        const cloned = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, cloned));
        return networkResponse;
      });
    })
  );
});