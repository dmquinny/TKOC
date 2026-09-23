// Service worker for the installed app. The panel itself is never cached, so
// a rebuilt panel always loads fresh; the only job here is to show a message
// with a retry button when the panel cannot be reached at all.
const OFFLINE_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><title>TKOC Control</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f6f3; color: #0b0b0b; font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; text-align: center; }
  main { padding: 32px 24px; max-width: 360px; }
  h1 { font-size: 18px; margin: 0 0 6px; }
  p { margin: 0 0 18px; color: #52514e; }
  button { font: inherit; font-weight: 500; padding: 9px 16px; border-radius: 8px; border: 1px solid rgba(11,11,11,.18); background: #fff; color: inherit; cursor: pointer; }
  @media (prefers-color-scheme: dark) {
    body { background: #0d0d0d; color: #fff; }
    p { color: #c3c2b7; }
    button { background: #1a1a19; border-color: rgba(255,255,255,.18); }
  }
</style></head>
<body><main><h1>Control panel unreachable</h1><p>This device is offline or the control panel is not running on the host.</p><button onclick="location.reload()">Try again</button></main></body></html>`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => new Response(OFFLINE_PAGE, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })));
});
