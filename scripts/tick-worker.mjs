const cronSecret = process.env.CRON_SECRET;
const port = process.env.PORT || '3400';
const endpoint = process.env.TICK_ENDPOINT || `http://127.0.0.1:${port}/api/cron/tick`;
const pollSeconds = Math.max(5, Number.parseInt(process.env.TICK_POLL_SECONDS || '30', 10));
const maxCatchUp = Math.max(1, Number.parseInt(process.env.TICK_MAX_CATCH_UP || '24', 10));

if (!cronSecret) {
  console.error('[TICK WORKER] CRON_SECRET is required.');
  process.exit(1);
}

let stopped = false;
let consecutiveFailures = 0;

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function requestTick() {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cronSecret}` },
    signal: AbortSignal.timeout(125_000),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 202) {
    throw new Error(`Tick endpoint returned ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function poll() {
  try {
    for (let attempt = 0; attempt < maxCatchUp && !stopped; attempt += 1) {
      const result = await requestTick();
      console.log(`[TICK WORKER] ${new Date().toISOString()} ${JSON.stringify(result)}`);
      consecutiveFailures = 0;

      if (!result.processed || !result.nextTickAt || new Date(result.nextTickAt).getTime() > Date.now()) {
        break;
      }
    }
  } catch (error) {
    consecutiveFailures += 1;
    console.error(`[TICK WORKER] Poll failed (${consecutiveFailures}/10):`, error);
    if (consecutiveFailures >= 10) process.exit(1);
  }
}

process.on('SIGTERM', () => { stopped = true; });
process.on('SIGINT', () => { stopped = true; });

console.log(`[TICK WORKER] Watching ${endpoint} every ${pollSeconds}s; max catch-up ${maxCatchUp}.`);
while (!stopped) {
  await poll();
  if (!stopped) await delay(pollSeconds * 1000);
}
