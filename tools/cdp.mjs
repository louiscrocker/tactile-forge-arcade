// Minimal zero-dep Chrome DevTools Protocol driver (Node 22 global WebSocket).
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

/**
 * Start headless Chrome on a throwaway profile.
 *
 * The debugging port defaults to 0: Chrome picks a free one and reports it in
 * `<profile>/DevToolsActivePort`. A fixed port collides with a previous run
 * that has not finished exiting — the new Chrome then binds only the IPv6
 * loopback and is unreachable on 127.0.0.1.
 */
export async function launch({ port = 0, width = 1440, height = 900 } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'tf-chrome-'));
  const proc = spawn(CHROME, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--headless=new',
    // Software WebGL so the GL back end is actually exercised headlessly.
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--mute-audio',
    `--window-size=${width},${height}`,
    'about:blank',
  ], { stdio: 'ignore' });

  // Wait for Chrome to report its debugging endpoint: port on the first line,
  // browser websocket path on the second.
  let active = null;
  for (let i = 0; i < 150 && !active; i++) {
    try {
      const [p, path] = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').trim().split('\n');
      if (Number(p) > 0 && path) active = { port: Number(p), path: path.trim() };
    } catch {}
    if (!active) await sleep(100);
  }
  const browser = { proc, profile, port: active?.port, wsUrl: null, closed: false };
  // A script that throws half-way must not leave Chrome running either.
  process.once('exit', () => {
    if (browser.closed || proc.exitCode !== null) return;
    killTree(proc);
  });
  if (!active) {
    // Don't leave the Chrome we just started running behind a failed launch.
    await close(browser);
    throw new Error('Chrome did not expose a debugging port');
  }
  browser.wsUrl = `ws://127.0.0.1:${active.port}${active.path}`;
  sweepStaleProfiles();
  return browser;
}

/**
 * Shut the browser down. Returns as soon as Chrome has acknowledged the
 * request rather than waiting for the process to disappear: a full exit has
 * been measured at 30 seconds to 3 minutes here, and nothing depends on it now
 * that each run gets its own port.
 */
export async function close(browser) {
  let acked = false;
  try {
    const root = await connect(browser.wsUrl);
    await Promise.race([
      root.send('Browser.close').then(() => { acked = true; }, () => {}),
      sleep(2000),
    ]);
  } catch {}
  if (!acked && browser.proc.exitCode === null) killTree(browser.proc);
  browser.closed = true;
}

function killTree(proc) {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    proc.kill('SIGKILL');
  }
}

/**
 * A profile can't be deleted while its Chrome is still shutting down, so each
 * launch clears out the ones earlier runs left behind. The age limit keeps
 * this away from a run that is still in progress in another terminal.
 */
function sweepStaleProfiles() {
  const cutoff = Date.now() - 60 * 60 * 1000;
  let names = [];
  try { names = readdirSync(tmpdir()); } catch {}
  for (const name of names) {
    if (!name.startsWith('tf-chrome-')) continue;
    const dir = join(tmpdir(), name);
    try {
      if (statSync(dir).mtimeMs < cutoff) rmSync(dir, { recursive: true, force: true });
    } catch {}
  }
}

export class Session {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    this.handlers = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id != null) {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
        }
      } else {
        this.events.push(msg);
        const h = this.handlers.get(msg.method);
        if (h) h(msg.params);
      }
    });
  }
  on(method, fn) { this.handlers.set(method, fn); }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`timeout: ${method}`)); }
      }, 30000);
    });
  }
}

export async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  return new Session(ws);
}

/** Attach to a fresh page target and return { session, sessionId, logs }. */
export async function newPage(browser) {
  const root = await connect(browser.wsUrl);
  const { targetId } = await root.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await root.send('Target.attachToTarget', { targetId, flatten: true });

  const logs = [];
  root.on('Runtime.consoleAPICalled', (p) => {
    logs.push({ kind: 'console', level: p.type, text: p.args.map(a => a.value ?? a.description ?? a.type).join(' ') });
  });
  root.on('Runtime.exceptionThrown', (p) => {
    const d = p.exceptionDetails;
    logs.push({ kind: 'exception', level: 'error', text: d.exception?.description || d.text, url: d.url, line: d.lineNumber });
  });
  root.on('Log.entryAdded', (p) => {
    logs.push({ kind: 'log', level: p.entry.level, text: p.entry.text, url: p.entry.url });
  });

  const sess = {
    send: (m, p) => root.send(m, p, sessionId),
    logs,
    root,
  };
  await sess.send('Page.enable');
  await sess.send('Runtime.enable');
  await sess.send('Log.enable');
  return sess;
}

export async function evaluate(sess, expression, { awaitPromise = true } = {}) {
  const r = await sess.send('Runtime.evaluate', {
    expression, awaitPromise, returnByValue: true, userGesture: true,
  });
  if (r.exceptionDetails) {
    throw new Error('EVAL ERROR: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  }
  return r.result.value;
}

const VK = {
  ' ': 32, 'w': 87, 'a': 65, 'd': 68, 'p': 80, 'Escape': 27,
  'ArrowUp': 38, 'ArrowLeft': 37, 'ArrowRight': 39, 'ArrowDown': 40,
};
const CODE = {
  ' ': 'Space', 'w': 'KeyW', 'a': 'KeyA', 'd': 'KeyD', 'p': 'KeyP', 'Escape': 'Escape',
  'ArrowUp': 'ArrowUp', 'ArrowLeft': 'ArrowLeft', 'ArrowRight': 'ArrowRight', 'ArrowDown': 'ArrowDown',
};

export async function key(sess, type, k) {
  await sess.send('Input.dispatchKeyEvent', {
    type,                                   // 'keyDown' | 'keyUp'
    key: k === ' ' ? ' ' : k,
    code: CODE[k] || k,
    windowsVirtualKeyCode: VK[k] || 0,
    nativeVirtualKeyCode: VK[k] || 0,
    text: type === 'keyDown' && k.length === 1 ? k : undefined,
  });
}

export async function screenshot(sess, path) {
  const { data } = await sess.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path, Buffer.from(data, 'base64'));
  return path;
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
