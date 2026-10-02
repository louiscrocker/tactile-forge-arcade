// =====================================================
// Tactile Forge · Grown-ups gate (shared by the nature & reading games)
//
// Anything that leaves the game or sends a child's data off the device goes
// through a quick grown-up check first:
//   - links to other websites (YouTube, Wikipedia, citizen-science sites)
//   - turning on the microphone ("I read to play"), which in Chrome sends
//     the child's voice to Google's speech service
// The check is a times-table question a young child can't answer at a glance.
// Read-aloud should prefer on-device voices: see pickLocalVoice().
//
//   <script src="js/grownups.js"></script>   (classic script; defines window.Grownups)
//   Grownups.guardOutboundLinks();                // once, at start-up
//   if (await Grownups.askGrownup({ reason: '…' })) { … }
//   const v = Grownups.pickLocalVoice(speechSynthesis.getVoices(), 'en-US');
//   if (await Grownups.confirmMicrophone()) { /* start recognition */ }
// Keep this file identical in every game that uses it.
// =====================================================

(function () {
'use strict';

const CSS = `
.gu-veil{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;
  background:rgba(6,14,20,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
  font:inherit;animation:gu-in .18s ease-out}
.gu-box{width:min(420px,calc(100vw - 32px));padding:22px 22px 18px;border-radius:20px;
  background:#fffdf7;color:#1d2a33;box-shadow:0 24px 60px rgba(0,0,0,.35);text-align:center}
.gu-box h2{margin:0 0 6px;font-size:22px;line-height:1.2}
.gu-box p{margin:0 0 14px;font-size:15px;line-height:1.45;color:#3e4f5a}
.gu-q{font-size:28px;font-weight:800;margin:6px 0 12px;letter-spacing:.02em}
.gu-in{width:120px;font:inherit;font-size:26px;font-weight:700;text-align:center;padding:8px 10px;
  border-radius:12px;border:2px solid #b9c7cf;outline:none}
.gu-in:focus{border-color:#2f8f6b;box-shadow:0 0 0 3px rgba(47,143,107,.25)}
.gu-err{min-height:20px;margin:8px 0 2px;color:#b23a3a;font-size:14px}
.gu-row{display:flex;gap:10px;justify-content:center;margin-top:10px}
.gu-btn{font:inherit;font-size:16px;font-weight:700;padding:10px 18px;border-radius:999px;border:0;cursor:pointer}
.gu-ok{background:#2f8f6b;color:#fff}.gu-cancel{background:#e7edf0;color:#24333c}
@keyframes gu-in{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.gu-veil{animation:none}}`;

let styled = false;
function ensureStyle() {
  if (styled) return;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.appendChild(s);
  styled = true;
}

let open = null; // the pending gate, so two prompts never stack

/**
 * Ask a grown-up to confirm. Resolves true only for the right answer.
 * @param {{title?: string, reason?: string}} opts
 */
function askGrownup({ title = 'Grown-ups only', reason = '' } = {}) {
  if (open) return open;
  ensureStyle();
  const a = 3 + Math.floor(Math.random() * 7);
  const b = 3 + Math.floor(Math.random() * 7);
  const prevFocus = document.activeElement;

  open = new Promise((resolve) => {
    const veil = document.createElement('div');
    veil.className = 'gu-veil';
    veil.setAttribute('role', 'dialog');
    veil.setAttribute('aria-modal', 'true');
    veil.setAttribute('aria-label', title);
    veil.innerHTML = `
      <form class="gu-box" novalidate>
        <h2></h2>
        <p class="gu-reason"></p>
        <div class="gu-q">${a} × ${b} = ?</div>
        <input class="gu-in" type="text" inputmode="numeric" autocomplete="off" aria-label="Answer" maxlength="3">
        <div class="gu-err" aria-live="polite"></div>
        <div class="gu-row">
          <button type="button" class="gu-btn gu-cancel">Cancel</button>
          <button type="submit" class="gu-btn gu-ok">OK</button>
        </div>
      </form>`;
    veil.querySelector('h2').textContent = title;
    veil.querySelector('.gu-reason').textContent = reason;
    const form = veil.querySelector('form');
    const input = veil.querySelector('.gu-in');
    const err = veil.querySelector('.gu-err');

    const done = (ok) => {
      window.removeEventListener('keydown', swallow, true);
      window.removeEventListener('keyup', swallow, true);
      veil.remove();
      open = null;
      if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch {}
      resolve(ok);
    };
    // Keep game key handlers (arrows, space, letters) from reacting while the
    // gate is open. Registered on window in the capture phase so it runs first.
    const swallow = (e) => {
      if (e.type === 'keydown' && e.key === 'Escape') { e.preventDefault(); done(false); }
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', swallow, true);
    window.addEventListener('keyup', swallow, true);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (Number(input.value.trim()) === a * b) done(true);
      else { err.textContent = 'Not quite — ask a grown-up to help.'; input.select(); }
    });
    veil.querySelector('.gu-cancel').addEventListener('click', () => done(false));
    veil.addEventListener('pointerdown', (e) => { if (e.target === veil) done(false); });
    document.body.appendChild(veil);
    input.focus();
  });
  return open;
}

/**
 * Route every click on a link to another website through the gate, including
 * links added later (fact cards, journal pages). Call once at start-up.
 */
function guardOutboundLinks(root = document) {
  root.addEventListener('click', async (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    let url;
    try { url = new URL(a.getAttribute('href'), location.href); } catch { return; }
    if (!/^https?:$/.test(url.protocol) || url.host === location.host) return;
    e.preventDefault();
    e.stopPropagation();
    const ok = await askGrownup({
      title: 'Leaving the game',
      reason: `This opens ${url.hostname.replace(/^www\./, '')} in a new tab. A grown-up should take a look first.`,
    });
    if (ok) window.open(url.href, '_blank', 'noopener');
  }, true);
}

/**
 * Choose a speech-synthesis voice that runs on the device, so read-aloud text
 * is never sent to an online voice service. Returns null if the device has no
 * local voice for the language; callers should then use the browser default
 * (which on most systems is also local) rather than an online "Google" voice.
 * @param {SpeechSynthesisVoice[]} voices
 * @param {string} lang  e.g. 'en-US'
 * @param {(v: SpeechSynthesisVoice) => number} [score]  optional preference among local voices
 */
function pickLocalVoice(voices, lang = 'en', score = () => 0) {
  const base = lang.toLowerCase().split('-')[0];
  const local = voices.filter((v) => v.localService);
  const exact = local.filter((v) => v.lang && v.lang.toLowerCase() === lang.toLowerCase());
  const same = local.filter((v) => v.lang && v.lang.toLowerCase().startsWith(base));
  const pool = exact.length ? exact : same;
  if (!pool.length) return null;
  return [...pool].sort((x, y) => score(y) - score(x))[0];
}

const MIC_KEY = 'tf-grownup-mic-ok';
/**
 * Gate for turning the microphone on. Asks once per browser session.
 * Resolves true if the grown-up agreed.
 */
async function confirmMicrophone() {
  try { if (sessionStorage.getItem(MIC_KEY) === '1') return true; } catch {}
  const ok = await askGrownup({
    title: 'Turn on the microphone?',
    reason: 'Reading out loud uses your browser’s speech recognition. In Chrome and Edge, that sends the child’s voice to Google or Microsoft to turn it into words. Nothing is saved by this game.',
  });
  if (ok) try { sessionStorage.setItem(MIC_KEY, '1'); } catch {}
  return ok;
}

window.Grownups = { askGrownup, guardOutboundLinks, pickLocalVoice, confirmMicrophone };
})();
