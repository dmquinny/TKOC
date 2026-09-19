#!/usr/bin/env node
/**
 * TKOC control panel.
 *
 * A single-file service, independent of the game itself, that lets an
 * administrator start, stop, restart, update, and roll back the game
 * containers and watch host and container statistics. It signs users in
 * against the same User table as the game (bcrypt password, admin access
 * level), so no extra accounts exist. Only the database needs to be up.
 *
 * Environment (read from the process, then from TKOC_ENV_FILE if present):
 *   DATABASE_URL             mysql://user:pass@host:port/db   (required)
 *   JWT_SECRET               used to sign the panel session cookie unless
 *   CONTROL_SESSION_SECRET   is set (one of the two is required)
 *   CONTROL_PORT             default 3401
 *   CONTROL_BIND             default 0.0.0.0
 *   TKOC_APP_DIR             folder holding compose.production.yaml and scripts/
 *   COMPOSE_FILE             default compose.production.yaml
 *   TKOC_HEALTH_URL          default http://127.0.0.1:3400/api/health
 *   CONTROL_AUTOHEAL         default on; 0 disables restarting an unhealthy game
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mariadb from 'mariadb';
import bcrypt from 'bcryptjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(process.env.TKOC_APP_DIR || path.resolve(here, '..'));
loadEnvFile(process.env.TKOC_ENV_FILE || path.resolve(appDir, '../appdata/tkoc-modern/.env.production'));

const config = {
  port: Number(process.env.CONTROL_PORT) || 3401,
  bind: process.env.CONTROL_BIND || '0.0.0.0',
  appDir,
  composeFile: process.env.COMPOSE_FILE || 'compose.production.yaml',
  healthUrl: process.env.TKOC_HEALTH_URL || 'http://127.0.0.1:3400/api/health',
  secret: process.env.CONTROL_SESSION_SECRET || process.env.JWT_SECRET || '',
  databaseUrl: process.env.DATABASE_URL || '',
  sessionSeconds: 12 * 60 * 60,
  containers: {
    web: 'tkoc-web',
    tick: 'tkoc-tick',
    db: process.env.TKOC_DB_CONTAINER || 'tkoc_db',
    control: 'tkoc-control',
  },
  diskPaths: [appDir, path.resolve(appDir, '../appdata/tkoc-modern'), '/'],
};

if (!config.secret) fail('Set CONTROL_SESSION_SECRET or JWT_SECRET.');
if (!config.databaseUrl) fail('Set DATABASE_URL.');

const ACTIONS = {
  start: { label: 'Start', command: ['docker', 'compose', '-f', config.composeFile, 'up', '-d', 'web', 'tick'] },
  stop: { label: 'Stop', command: ['docker', 'compose', '-f', config.composeFile, 'stop', 'tick', 'web'] },
  restart: { label: 'Restart', command: ['docker', 'compose', '-f', config.composeFile, 'up', '-d', '--force-recreate', 'web', 'tick'] },
  update: { label: 'Update', command: ['sh', 'scripts/update.sh'] },
  'update-full': { label: 'Full update', command: ['sh', 'scripts/update.sh', '--full'] },
  rollback: { label: 'Roll back', command: ['sh', 'scripts/rollback.sh'] },
  prune: { label: 'Prune Docker', command: ['docker', 'image', 'prune', '-f'] },
};

const page = readFileSync(path.join(here, 'page.html'), 'utf8');
// After a reboot Docker starts every container at once, ignoring depends_on,
// so the panel can come up before MySQL. A pool created while MySQL is still
// starting stays empty and never recovers: the panel could not sign anyone in
// for a day after the 18 Sep 2026 reboot. Wait until MySQL is ready first.
await waitForDatabase(config.databaseUrl);
const pool = createPool(config.databaseUrl);
const loginAttempts = new Map();
const jobs = { current: null, history: [] };
const streams = new Set();

// ---------------------------------------------------------------- helpers

function fail(message) {
  console.error(`[control] ${message}`);
  process.exit(1);
}

function loadEnvFile(file) {
  if (!file || !existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function createPool(url) {
  const parsed = new URL(url.replace(/^mysql:/, 'mariadb:'));
  return mariadb.createPool({
    host: parsed.hostname || '127.0.0.1',
    port: Number(parsed.port) || 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ''),
    connectionLimit: 3,
    connectTimeout: 5000,
    acquireTimeout: 7000,
    bigIntAsNumber: true,
  });
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payload) {
  return createHmac('sha256', config.secret).update(payload).digest('base64url');
}

function issueSession(user) {
  const payload = base64url(JSON.stringify({
    id: user.id,
    username: user.username,
    exp: Math.floor(Date.now() / 1000) + config.sessionSeconds,
    nonce: randomBytes(8).toString('hex'),
  }));
  return `${payload}.${sign(payload)}`;
}

function readSession(request) {
  const cookie = parseCookies(request.headers.cookie).tkoc_control;
  if (!cookie) return null;
  const [payload, signature] = cookie.split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (expected.length !== signature.length) return null;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!session.exp || session.exp * 1000 < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

function isSecure(request) {
  return request.headers['x-forwarded-proto'] === 'https';
}

function sessionCookie(request, value, maxAge) {
  const parts = [`tkoc_control=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAge}`];
  if (isSecure(request)) parts.push('Secure');
  return parts.join('; ');
}

function clientIp(request) {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return request.socket.remoteAddress || 'unknown';
}

function tooManyAttempts(key) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now - entry.start > 15 * 60 * 1000) {
    loginAttempts.set(key, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > 10;
}

function json(response, status, body, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', chunk => {
      size += chunk.length;
      if (size > 64 * 1024) {
        reject(new Error('Body too large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    request.on('error', reject);
  });
}

function run(command, args, { cwd = config.appDir, timeout = 30_000 } = {}) {
  return new Promise(resolve => {
    const child = spawn(command, args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

/** Short, credential-free explanation of a MariaDB driver failure. */
function describeDatabaseError(error) {
  const parsed = new URL(config.databaseUrl.replace(/^mysql:/, 'mariadb:'));
  const where = `${parsed.hostname || '127.0.0.1'}:${parsed.port || 3306}`;
  const text = String(error?.message ?? '');
  if (/ECONNREFUSED/.test(text)) return `Nothing is listening at ${where}: the database container is probably stopped.`;
  if (/ETIMEDOUT|timeout|retrieve a connection/i.test(text)) return `Connection to ${where} timed out.`;
  if (/Access denied/i.test(text)) return `MySQL rejected the application login at ${where}: the password in .env.production does not match the database.`;
  if (/Unknown database/i.test(text)) return `The database named in DATABASE_URL does not exist at ${where}.`;
  return `(${error?.code || 'error'} at ${where})`;
}

/** Resolves once MySQL sends its greeting, which it only does when ready for connections. */
async function waitForDatabase(databaseUrl) {
  const url = new URL(databaseUrl.replace(/^mysql:/, 'mariadb:'));
  const host = url.hostname || '127.0.0.1';
  const port = Number(url.port) || 3306;
  for (let attempt = 1; ; attempt += 1) {
    const ready = await new Promise(resolve => {
      const socket = connect(port, host);
      socket.setTimeout(3000);
      socket.once('data', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => resolve(false));
      socket.once('timeout', () => { socket.destroy(); resolve(false); });
    });
    if (ready) return;
    if (attempt === 1 || attempt % 15 === 0) console.log(`[control] waiting for MySQL at ${host}:${port}...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

function parseJsonLines(text) {
  return text.split(/\r?\n/).filter(Boolean).flatMap(line => {
    try {
      const value = JSON.parse(line);
      return Array.isArray(value) ? value : [value];
    } catch {
      return [];
    }
  });
}

// ---------------------------------------------------------------- authentication

async function authenticate(username, password) {
  const rows = await pool.query(
    'SELECT `userID`, `username`, `password`, `access`, `status` FROM `User` WHERE `username` = ? LIMIT 1',
    [username],
  );
  const user = rows[0];
  if (!user || !user.password) return { error: 'Invalid credentials' };
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return { error: 'Invalid credentials' };
  if (user.status === 'Banned') return { error: 'This account is banned' };
  if (Number(user.access) !== 1) return { error: 'This account is not an administrator' };
  return { user: { id: user.userID, username: user.username } };
}

// ---------------------------------------------------------------- jobs

function broadcast(event, data) {
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const stream of streams) stream.write(frame);
}

function startJob(action, user) {
  if (jobs.current && jobs.current.exitCode === null) return null;
  const definition = ACTIONS[action];
  const job = {
    id: randomBytes(6).toString('hex'),
    action,
    label: definition.label,
    command: definition.command.join(' '),
    startedBy: user.username,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    lines: [],
  };
  jobs.current = job;
  broadcast('job', summarize(job));
  const child = spawn(definition.command[0], definition.command.slice(1), {
    cwd: config.appDir,
    env: { ...process.env, TKOC_HEALTH_URL: config.healthUrl },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const push = (stream, chunk) => {
    for (const line of chunk.toString('utf8').split(/\r?\n/)) {
      if (!line) continue;
      const entry = { stream, line, at: Date.now() };
      job.lines.push(entry);
      if (job.lines.length > 2000) job.lines.shift();
      broadcast('line', entry);
    }
  };
  child.stdout.on('data', chunk => push('out', chunk));
  child.stderr.on('data', chunk => push('err', chunk));
  const finish = code => {
    if (job.exitCode !== null) return;
    job.exitCode = code;
    job.finishedAt = new Date().toISOString();
    jobs.history.unshift(summarize(job));
    jobs.history = jobs.history.slice(0, 20);
    broadcast('job', summarize(job));
  };
  child.on('error', error => {
    push('err', Buffer.from(error.message));
    finish(-1);
  });
  child.on('close', code => finish(code ?? -1));
  console.log(`[control] ${user.username} started ${action}`);
  return job;
}

function summarize(job) {
  if (!job) return null;
  const { lines, ...rest } = job;
  return { ...rest, lineCount: lines.length };
}

// ---------------------------------------------------------------- status and statistics

async function containerStatus() {
  const result = await run('docker', ['ps', '-a', '--format', '{{json .}}'], { timeout: 15_000 });
  const found = new Map(parseJsonLines(result.stdout).map(entry => [entry.Names, entry]));
  // One entry per expected container, in a fixed order, so the page can show
  // a container that was never created instead of silently omitting it.
  return Object.entries(config.containers).map(([role, name]) => {
    const entry = found.get(name);
    if (!entry) return { role, name, state: 'missing', status: 'Not created', image: '', running: false };
    return {
      role,
      name,
      state: entry.State,
      status: entry.Status,
      image: entry.Image,
      running: entry.State === 'running',
    };
  });
}

async function healthStatus() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(config.healthUrl, { signal: controller.signal });
    clearTimeout(timer);
    const body = await response.json().catch(() => ({}));
    return { reachable: true, httpStatus: response.status, ...body };
  } catch {
    return { reachable: false };
  }
}

async function gameStatus() {
  try {
    const [state] = await pool.query('SELECT `age`, `tick`, `season`, `phase`, `lastTickAt`, `nextTickAt` FROM `GameState` WHERE `id` = 1');
    const [provinces] = await pool.query("SELECT COUNT(*) AS `count` FROM `Province` WHERE `status` = 'Alive'");
    const [users] = await pool.query('SELECT COUNT(*) AS `count` FROM `User`');
    const [size] = await pool.query('SELECT COALESCE(SUM(`data_length` + `index_length`), 0) AS `bytes` FROM information_schema.tables WHERE `table_schema` = DATABASE()');
    return {
      connected: true,
      age: state?.age ?? null,
      tick: state?.tick ?? null,
      season: state?.season ?? null,
      phase: state?.phase ?? null,
      lastTickAt: state?.lastTickAt ? new Date(state.lastTickAt).toISOString() : null,
      nextTickAt: state?.nextTickAt ? new Date(state.nextTickAt).toISOString() : null,
      provinces: Number(provinces?.count ?? 0),
      users: Number(users?.count ?? 0),
      databaseBytes: Number(size?.bytes ?? 0),
    };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

async function diskUsage() {
  const seen = new Set();
  const out = [];
  for (const target of config.diskPaths) {
    if (!existsSync(target)) continue;
    const result = await run('df', ['-kP', target], { timeout: 10_000 });
    const line = result.stdout.trim().split('\n').pop();
    if (!line) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 6) continue;
    const key = parts[0] + parts[5];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      path: target,
      filesystem: parts[0],
      totalBytes: Number(parts[1]) * 1024,
      usedBytes: Number(parts[2]) * 1024,
      availableBytes: Number(parts[3]) * 1024,
      usePercent: Number(parts[4].replace('%', '')),
      mount: parts[5],
    });
  }
  return out;
}

async function dockerStats() {
  const [stats, df] = await Promise.all([
    run('docker', ['stats', '--no-stream', '--format', '{{json .}}'], { timeout: 20_000 }),
    run('docker', ['system', 'df', '--format', '{{json .}}'], { timeout: 20_000 }),
  ]);
  const wanted = new Set(Object.values(config.containers));
  return {
    containers: parseJsonLines(stats.stdout)
      .filter(entry => wanted.has(entry.Name))
      .map(entry => ({
        name: entry.Name,
        cpu: entry.CPUPerc,
        memory: entry.MemUsage,
        memoryPercent: entry.MemPerc,
        network: entry.NetIO,
        block: entry.BlockIO,
        pids: entry.PIDs,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    usage: parseJsonLines(df.stdout).map(entry => ({
      type: entry.Type,
      total: entry.TotalCount,
      active: entry.Active,
      size: entry.Size,
      reclaimable: entry.Reclaimable,
    })),
  };
}

function hostStats() {
  const total = os.totalmem();
  const free = os.freemem();
  return {
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    cpus: os.cpus().length,
    load: os.loadavg().map(value => Math.round(value * 100) / 100),
    uptimeSeconds: Math.floor(os.uptime()),
    memory: { totalBytes: total, freeBytes: free, usedBytes: total - free },
    panelUptimeSeconds: Math.floor(process.uptime()),
  };
}

// A rolling hour of host load and memory, so the trend lines are already
// populated when the page opens rather than starting empty on every visit.
const hostHistory = [];

function sampleHost() {
  const total = os.totalmem();
  hostHistory.push({
    at: Date.now(),
    load: Math.round(os.loadavg()[0] * 100) / 100,
    memoryPercent: Math.round(((total - os.freemem()) / total) * 1000) / 10,
  });
  if (hostHistory.length > 120) hostHistory.shift();
}

sampleHost();
setInterval(sampleHost, 30_000).unref();

// ---------------------------------------------------------------- server

async function handle(request, response) {
  const url = new URL(request.url, 'http://control.local');
  const session = readSession(request);

  if (request.method === 'GET' && url.pathname === '/') {
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
    });
    response.end(page);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/login') {
    const ip = clientIp(request);
    const body = await readBody(request);
    const username = String(body.username ?? '').trim().slice(0, 16);
    const password = String(body.password ?? '').slice(0, 72);
    if (!username || !password) return json(response, 400, { error: 'Username and password are required' });
    if (tooManyAttempts(`${ip}:${username.toLowerCase()}`)) return json(response, 429, { error: 'Too many attempts. Try again in 15 minutes.' });
    let outcome;
    try {
      outcome = await authenticate(username, password);
    } catch (error) {
      console.error('[control] login failed to reach the database:', error.message);
      return json(response, 503, { error: `The database is not reachable, so sign-in is unavailable. ${describeDatabaseError(error)}` });
    }
    if (outcome.error) return json(response, 401, { error: outcome.error });
    console.log(`[control] ${outcome.user.username} signed in from ${ip}`);
    return json(response, 200, { user: outcome.user }, {
      'Set-Cookie': sessionCookie(request, issueSession(outcome.user), config.sessionSeconds),
    });
  }

  if (request.method === 'POST' && url.pathname === '/api/logout') {
    return json(response, 200, { ok: true }, { 'Set-Cookie': sessionCookie(request, '', 0) });
  }

  if (!session) return json(response, 401, { error: 'Sign in required' });

  if (request.method === 'GET' && url.pathname === '/api/session') {
    return json(response, 200, { user: { id: session.id, username: session.username }, appDir: config.appDir, actions: Object.entries(ACTIONS).map(([id, action]) => ({ id, label: action.label, command: action.command.join(' ') })) });
  }

  if (request.method === 'GET' && url.pathname === '/api/status') {
    const [containers, health, game] = await Promise.all([containerStatus(), healthStatus(), gameStatus()]);
    return json(response, 200, {
      time: new Date().toISOString(),
      containers,
      health,
      game,
      job: summarize(jobs.current),
      history: jobs.history,
      autoHeal: {
        enabled: autoHeal.enabled,
        lastRestartAt: autoHeal.lastRestartAt ? new Date(autoHeal.lastRestartAt).toISOString() : null,
      },
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/stats') {
    const [disks, docker] = await Promise.all([diskUsage(), dockerStats()]);
    return json(response, 200, { time: new Date().toISOString(), host: hostStats(), history: hostHistory, disks, docker });
  }

  if (request.method === 'GET' && url.pathname === '/api/logs') {
    const service = url.searchParams.get('service') || 'web';
    const container = config.containers[service];
    if (!container) return json(response, 400, { error: 'Unknown service' });
    const lines = Math.min(1000, Math.max(10, Number(url.searchParams.get('lines')) || 200));
    const result = await run('docker', ['logs', '--tail', String(lines), '--timestamps', container], { timeout: 15_000 });
    const merged = `${result.stdout}${result.stderr}`.split(/\r?\n/).filter(Boolean).sort().join('\n');
    return json(response, 200, { container, lines: merged });
  }

  if (request.method === 'GET' && url.pathname === '/api/job') {
    return json(response, 200, { job: jobs.current ? { ...summarize(jobs.current), lines: jobs.current.lines } : null });
  }

  if (request.method === 'GET' && url.pathname === '/api/events') {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });
    response.write(`event: hello\ndata: ${JSON.stringify({ job: summarize(jobs.current) })}\n\n`);
    streams.add(response);
    const keepAlive = setInterval(() => response.write(': ping\n\n'), 25_000);
    request.on('close', () => {
      clearInterval(keepAlive);
      streams.delete(response);
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/action') {
    if (request.headers['x-requested-with'] !== 'tkoc-control') return json(response, 403, { error: 'Rejected request' });
    const body = await readBody(request);
    const action = String(body.action ?? '');
    if (!ACTIONS[action]) return json(response, 400, { error: 'Unknown action' });
    const job = startJob(action, session);
    if (!job) return json(response, 409, { error: `${jobs.current.label} is still running` });
    return json(response, 202, { job: summarize(job) });
  }

  json(response, 404, { error: 'Not found' });
}

// ---------------------------------------------------------------- auto-heal

// Docker marks tkoc-web unhealthy but never restarts it. When the game's
// database pool wedges (as it did for 24 hours after the 18 Sep 2026 reboot),
// recreating the containers is the only cure, so run the Restart action.
// It only acts on a running container that Docker reports unhealthy on two
// checks in a row: a deliberately stopped game or one mid-update is left alone,
// startJob refuses while another action is running, and the cooldown stops a
// database outage turning into a restart loop.
const autoHeal = {
  enabled: process.env.CONTROL_AUTOHEAL !== '0',
  intervalMs: 60_000,
  cooldownMs: 15 * 60_000,
  strikes: 0,
  lastRestartAt: 0,
};

async function autoHealCheck() {
  if (jobs.current && jobs.current.exitCode === null) return;
  const result = await run('docker', [
    'inspect', '-f', '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}', config.containers.web,
  ], { timeout: 15_000 });
  const [state, health] = result.stdout.trim().split(/\s+/);
  if (state !== 'running' || health !== 'unhealthy') {
    autoHeal.strikes = 0;
    return;
  }
  autoHeal.strikes += 1;
  if (autoHeal.strikes < 2 || Date.now() - autoHeal.lastRestartAt < autoHeal.cooldownMs) return;
  if (startJob('restart', { username: 'auto-heal' })) {
    autoHeal.lastRestartAt = Date.now();
    autoHeal.strikes = 0;
  }
}

if (autoHeal.enabled) {
  setInterval(() => {
    autoHealCheck().catch(error => console.error('[control] auto-heal check failed:', error));
  }, autoHeal.intervalMs);
}

const server = createServer((request, response) => {
  handle(request, response).catch(error => {
    console.error('[control] request failed:', error);
    if (!response.headersSent) json(response, 500, { error: error.message || 'Request failed' });
    else response.end();
  });
});

server.listen(config.port, config.bind, () => {
  console.log(`[control] listening on http://${config.bind}:${config.port} for ${config.appDir}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close();
    pool.end().catch(() => {});
    process.exit(0);
  });
}
