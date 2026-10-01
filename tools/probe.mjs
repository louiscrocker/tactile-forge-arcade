// =====================================================
// Tactile Forge Arcade · Load a page in headless Chrome and report on it
//   node tools/probe.mjs <url> [steps...]
// Steps run in order:
//   wait:<ms>            sleep
//   until:<js expr>      poll until truthy (15 s)
//   click:<css selector> click an element
//   key:<key>            press a key (e.g. key:Enter, key:" ")
//   eval:<js>            run JS in the page (wrapped in an IIFE)
//   shot:<file.png>      screenshot
//   size:<w>x<h>         set the viewport
// Prints JSON: failed requests, third-party requests, console errors.
// Exit code 1 if any request failed, any third-party request was made, or a
// console error was logged.
// =====================================================

import { launch, close, newPage, evaluate, screenshot, key, sleep } from './cdp.mjs';

const [url, ...steps] = process.argv.slice(2);
if (!url) { console.error('usage: node tools/probe.mjs <url> [steps...]'); process.exit(2); }
const origin = new URL(url).host;

const browser = await launch();
const p = await newPage(browser);
const failed = [], thirdParty = new Set(), notes = [];
await p.send('Network.enable');
p.root.on('Network.requestWillBeSent', (e) => {
  try {
    const u = new URL(e.request.url);
    if (/^https?:$/.test(u.protocol) && u.host !== origin) thirdParty.add(u.host + u.pathname.slice(0, 40));
  } catch {}
});
p.root.on('Network.responseReceived', (e) => { if (e.response.status >= 400) failed.push(`${e.response.status} ${e.response.url}`); });
p.root.on('Network.loadingFailed', (e) => { if (!e.canceled && !/ERR_ABORTED/.test(e.errorText)) failed.push(`${e.errorText} ${e.requestId}`); });

await p.send('Page.navigate', { url });
for (const step of steps) {
  const i = step.indexOf(':');
  const [op, arg] = i < 0 ? [step, ''] : [step.slice(0, i), step.slice(i + 1)];
  try {
    if (op === 'wait') await sleep(Number(arg));
    else if (op === 'until') {
      const t0 = Date.now(); let ok = false;
      while (Date.now() - t0 < 15000) { try { if (await evaluate(p, `!!(${arg})`)) { ok = true; break; } } catch {} await sleep(80); }
      notes.push(`until ${arg}: ${ok ? 'ok' : 'TIMEOUT'}`);
    }
    else if (op === 'click') notes.push(`click ${arg}: ${await evaluate(p, `(() => { const e = document.querySelector(${JSON.stringify(arg)}); if (!e) return 'MISSING'; e.click(); return 'ok'; })()`)}`);
    else if (op === 'key') { await key(p, 'keyDown', arg); await sleep(60); await key(p, 'keyUp', arg); }
    else if (op === 'eval') notes.push(`eval: ${JSON.stringify(await evaluate(p, `(async () => { ${arg} })()`))}`);
    else if (op === 'shot') { await screenshot(p, arg); notes.push(`shot ${arg}`); }
    else if (op === 'size') {
      const [w, h] = arg.split('x').map(Number);
      await p.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    }
    else notes.push(`unknown step ${step}`);
  } catch (err) { notes.push(`${step}: ERROR ${err.message}`); }
}
const errors = p.logs.filter(l => l.level === 'error').map(l => l.text);
const title = await evaluate(p, 'document.title').catch(() => null);
await close(browser);
const report = { url, title, failed, thirdParty: [...thirdParty], errors, notes };
console.log(JSON.stringify(report, null, 2));
process.exit(failed.length || thirdParty.size || errors.length ? 1 : 0);
