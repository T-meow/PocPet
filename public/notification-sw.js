// Notification display only: no fetch handler, cached game files or background timer.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', event => {
  const data = event.notification.data || {};
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL(data.url || self.registration.scope);
    if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = clients.find(client => new URL(client.url).pathname === url.pathname);
    if (existing) {
      await existing.focus();
      existing.postMessage({ type: 'pocpet-notification', owner: data.owner, target: data.target });
    } else {
      url.searchParams.set('pocpet-notification', data.target || '');
      url.searchParams.set('notification-owner', data.owner || '');
      await self.clients.openWindow(url.href);
    }
  })());
});
