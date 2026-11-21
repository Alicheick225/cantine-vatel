// Mode hors ligne (bonus du guide) : stratégie « réseau d'abord ».
// En ligne, on sert toujours la version la plus récente (jamais d'ancienne version pendant une démo) ;
// hors ligne, on sert la dernière copie gardée de l'application, pour afficher le ticket.
// Les appels à Supabase (autre domaine) ne sont jamais mis en cache.
const CACHE = 'cantine-vatel-v3'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return
  e.respondWith(
    fetch(req)
      .then((rep) => {
        if (rep.ok) {
          const copie = rep.clone()
          caches.open(CACHE).then((c) => c.put(req.mode === 'navigate' ? '/' : req, copie))
        }
        return rep
      })
      .catch(() => caches.match(req.mode === 'navigate' ? '/' : req).then((r) => r || caches.match('/'))),
  )
})

// Notifications push (application fermée) : le service worker reçoit le message et l'affiche.
self.addEventListener('push', (e) => {
  let m = { titre: 'Cantine Vatel', corps: '', url: '/' }
  try { m = { ...m, ...e.data.json() } } catch { if (e.data) m.corps = e.data.text() }
  e.waitUntil(self.registration.showNotification(m.titre, {
    body: m.corps,
    icon: '/icone-192.png',
    badge: '/icone-192.png',
    tag: m.cle,
    data: { url: m.url },
  }))
})

// Toucher la notification ouvre l'application sur la bonne page (ou ramène l'onglet déjà ouvert).
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      const ouverte = fenetres.find((f) => new URL(f.url).origin === self.location.origin)
      if (ouverte) return ouverte.focus().then((f) => f.navigate(url))
      return self.clients.openWindow(url)
    }),
  )
})
