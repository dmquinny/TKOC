// Service worker for the installed game. Nothing is cached, so every visit
// loads the live game; its only job is to show a message with a retry button
// when the server cannot be reached, instead of the browser's error page.
const OFFLINE_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>The Kingdoms of Chaos</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0f0d0a; color: #e8dcc0; font: 16px/1.5 Georgia, "Times New Roman", serif; text-align: center; }
  main { padding: 32px 24px; max-width: 380px; }
  h1 { margin: 0 0 8px; font-size: 22px; color: #f0c674; letter-spacing: .04em; }
  p { margin: 0 0 22px; color: #b7a882; }
  button { font: inherit; padding: 10px 22px; border-radius: 4px; border: 1px solid #f0c674; background: linear-gradient(180deg, #f0c674, #c8952f); color: #2a1e08; font-weight: 700; cursor: pointer; }
</style></head>
<body><main><h1>The realm is out of reach</h1><p>Your device is offline or the game server is not responding right now.</p><button onclick="location.reload()">Try again</button></main></body></html>`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => new Response(OFFLINE_PAGE, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })));
});
