/* Dependency-free Chrome DevTools Protocol driver.
   Real time, not virtual time — rAF and IntersectionObserver both need it.

   usage: node tools/probe.mjs <url> [--w 1440] [--h 900] [--wait 5000]
                               [--shot out.png] [--mobile] [--eval file.js]
*/
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME_PATH ||
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : 'google-chrome');

const args = process.argv.slice(2);
const url = args[0];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i > -1 ? args[i + 1] : d; };
const has = (k) => args.includes('--' + k);

const W = +opt('w', 1440), H = +opt('h', 900);
const WAIT = +opt('wait', 5000);
const SHOT = opt('shot', null);
const EVALF = opt('eval', null);
const PORT = 9333 + (Math.floor(Math.random() * 400));

const profile = mkdtempSync(join(tmpdir(), 'gvprobe-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--force-device-scale-factor=1', '--allow-file-access-from-files',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`, url
], { stdio: 'ignore', detached: false });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function findTarget() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const pg = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (pg) return pg.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(150);
  }
  throw new Error('Chrome did not expose a page target');
}

let id = 0;
const pending = new Map();
const logs = [];
const errors = [];

function send(ws, method, params = {}) {
  const msgId = ++id;
  return new Promise((resolve, reject) => {
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}

const out = { ok: true, errors, logs, results: null };

try {
  const wsUrl = await findTarget();
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
      return;
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errors.push((d.exception && (d.exception.description || d.exception.value)) || d.text);
    }
    if (m.method === 'Runtime.consoleAPICalled') {
      const txt = (m.params.args || []).map(a => a.value ?? a.description ?? a.type).join(' ');
      logs.push(m.params.type + ': ' + txt);
      if (m.params.type === 'error') errors.push(txt);
    }
    if (m.method === 'Log.entryAdded') {
      const e = m.params.entry;
      logs.push(e.level + ': ' + e.text);
      if (e.level === 'error') errors.push(e.text + ' ' + (e.url || ''));
    }
  };

  await send(ws, 'Runtime.enable');
  await send(ws, 'Log.enable');
  await send(ws, 'Page.enable');

  /* Always pin the viewport: --window-size is the OS window, which is a
     dozen pixels larger than the page gets. Screenshots and any geometry
     assertion need the exact number. */
  await send(ws, 'Emulation.setDeviceMetricsOverride', {
    width: W, height: H,
    deviceScaleFactor: has('mobile') ? 2 : 1,
    mobile: has('mobile')
  });
  if (has('reduce')) {
    await send(ws, 'Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });
  }
  await send(ws, 'Page.navigate', { url });
  await sleep(WAIT);

  if (EVALF) {
    const expr = readFileSync(EVALF, 'utf8');
    const r = await send(ws, 'Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise: true
    });
    if (r.exceptionDetails) {
      errors.push('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    } else {
      out.results = r.result.value;
    }
  }

  if (SHOT) {
    const r = await send(ws, 'Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(SHOT, Buffer.from(r.data, 'base64'));
  }

  ws.close();
} catch (e) {
  out.ok = false;
  errors.push('driver: ' + e.message);
} finally {
  try { chrome.kill(); } catch { /* already gone */ }
  await sleep(250);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* locked */ }
}

out.ok = out.ok && errors.length === 0;
console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);
