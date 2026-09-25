// Browser service workers must be served as JavaScript files. This tiny
// runtime exists only to display task-completion notifications and focus
// the existing OpenDesign tab when the user clicks one.

function sameOriginNotificationUrl(raw) {
  const fallback = self.location.origin;
  if (typeof raw !== 'string' || raw.length === 0) return fallback;
  try {
    const url = new URL(raw, self.location.origin);
    if (url.origin !== self.location.origin) return fallback;
    return url.href;
  } catch {
    return fallback;
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = sameOriginNotificationUrl(data.url);

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    const sameOrigin = windows.find((client) => {
      try {
        return new URL(client.url).origin === self.location.origin;
      } catch {
        return false;
      }
    });

    if (sameOrigin) {
      if ('navigate' in sameOrigin) {
        try {
          await sameOrigin.navigate(targetUrl);
        } catch {
          /* focus the existing tab below */
        }
      }
      return sameOrigin.focus();
    }

    if (self.clients.openWindow) {
      return self.clients.openWindow(targetUrl);
    }
    return undefined;
  })());
});
