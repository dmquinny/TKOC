'use client';

import { useEffect } from 'react';

// Registers public/sw.js, which lets phones install the game from the browser
// and shows an offline page when the server cannot be reached. Browsers only
// allow service workers over HTTPS (and on localhost), so elsewhere this is a
// no-op.
export default function RegisterServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
