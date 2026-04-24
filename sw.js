// =============================================================================
// SiteLog v3.0 — Service Worker (sw.js)
// Στρατηγική: Precache όλων των κρίσιμων αρχείων + δυναμικό caching
// Δημιουργεί πλήρως offline-ready PWA.
// Υποστηρίζει offline-sync (IndexedDB) χωρίς να παρεμβαίνει.
// =============================================================================

const CACHE_NAME = 'sitelog-v3.0';
const PRECACHE_URLS = [
  // ── Core pages ──
  'index.html',
  'login.html',
  'set-password.html',
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

  // ── Shared assets ──
  'shared/theme.css',
  'shared/auth.js',
  'shared/toast.js',
  'shared/offline-sync.js',

  // ── PWA assets ──
  'manifest.json',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',

  // ── Google Fonts (προκαταβολική cache των CSS αρχείων)
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap',

  // ── CDN styles (θα προσπαθήσουμε να τα precache)
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css',
  'https://cdn.jsdelivr.net/npm/quill@2/dist/quill.snow.css',

  // ── CDN scripts (κρίσιμα για την εφαρμογή)
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://unpkg.com/@zxing/library@0.19.1/umd/index.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/flatpickr',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/gr.js',
  'https://cdn.jsdelivr.net/npm/quill@2/dist/quill.js',
  'https://www.dropbox.com/static/api/2/dropins.js',
  'https://ikmwxsfaopjkgajebyyf.supabase.co/functions/v1/invite-user'   // Edge Function URL (optional)
];

// ── INSTALL: Προσθήκη όλων των αρχείων στην cache ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Precaching…');
      // Χρησιμοποιούμε addAll για να προσθέσουμε όλα τα URLs, ακόμα και αν κάποιο αποτύχει (catch)
      const addPromises = PRECACHE_URLS.map(url => {
        return cache.add(url).catch(err => {
          console.warn('[SW] Failed to precache:', url, err);
        });
      });
      return Promise.all(addPromises);
    })
    .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: Καθαρισμός παλιών caches ─────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      );
    })
    .then(() => self.clients.claim())
  );
});

// ── FETCH: Στρατηγική ανάκτησης πόρων ──────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Μην παρεμβαίνουμε σε αιτήματα εκτός του scope μας (εκτός από CDN)
  if (!url.origin.startsWith(self.location.origin) && 
      !url.href.startsWith('https://fonts.googleapis.com') &&
      !url.href.startsWith('https://fonts.gstatic.com') &&
      !url.href.startsWith('https://cdn.jsdelivr.net') &&
      !url.href.startsWith('https://unpkg.com') &&
      !url.href.startsWith('https://cdnjs.cloudflare.com') &&
      !url.href.startsWith('https://www.dropbox.com') &&
      !url.href.startsWith('https://ikmwxsfaopjkgajebyyf.supabase.co')) {
    return; // άφησε το browser να χειριστεί άλλα domains
  }

  // ── Supabase API: network-only, χωρίς cache ───────────────────────────
  if (url.hostname === 'ikmwxsfaopjkgajebyyf.supabase.co') {
    event.respondWith(fetch(request));
    return;
  }

  // ── Manifest & εικονίδια: cache-first ─────────────────────────────────
  if (request.destination === 'manifest' || request.url.includes('/icons/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        return cached || fetch(request).then(response => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, cloned));
          return response;
        });
      })
    );
    return;
  }

  // ── HTML σελίδες: Network-first, πέφτοντας στην cache ────────────────
  if (request.mode === 'navigate' ||
      (request.headers.has('Accept') && request.headers.get('Accept').includes('text/html'))) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, cloned));
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match('index.html')))
    );
    return;
  }

  // ── JS & CSS (τοπικά + CDN): Cache-first ---------------------------------
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      caches.match(request).then(cached => {
        const fetchPromise = fetch(request)
          .then(response => {
            if (response.ok) {
              const cloned = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, cloned));
            }
            return response;
          });
        return cached || fetchPromise;
      })
    );
    return;
  }

  // ── Εικόνες / Γραμματοσειρές: Cache-first (μακροπρόθεσμη cache) ──────
  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, cloned));
          return response;
        });
      })
    );
    return;
  }

  // ── Όλα τα άλλα: Stale-while-revalidate (π.χ. API calls, workers) ──────
  event.respondWith(
    caches.match(request).then(cached => {
      const fetched = fetch(request)
        .then(response => {
          caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
          return response;
        });
      return cached || fetched;
    })
  );
});