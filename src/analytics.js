// ---------------------------------------------------------------------------
// Anonymous usage stats, shown on the private /admin page. No IP, name or
// account is sent: only a random id kept in this browser, plus what was played.
// Never throws and never blocks the game; off for local dev and Do-Not-Track.
// ---------------------------------------------------------------------------
const API = 'https://tdp-fighter.vercel.app/api/track'; // the Vercel copy hosts the API

const host = location.hostname;
const sameOrigin = host.endsWith('.vercel.app');
const enabled =
  /^https?:$/.test(location.protocol) &&
  !['localhost', '127.0.0.1', '[::1]'].includes(host) && !host.endsWith('.local') &&
  navigator.doNotTrack !== '1';

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

function deviceId() {
  try {
    let id = localStorage.getItem('tdp-device');
    if (id) return { id, returning: true };
    id = uid();
    localStorage.setItem('tdp-device', id);
    return { id, returning: false };
  } catch {
    return { id: uid(), returning: false };
  }
}

const device = deviceId();
const sessionId = uid();

function send(type, data = {}, matchId) {
  if (!enabled) return;
  try {
    fetch(sameOrigin ? '/api/track' : API, {
      method: 'POST',
      // text/plain keeps this a "simple" cross-origin request (no preflight).
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ type, device_id: device.id, session_id: sessionId, match_id: matchId, host, data }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* analytics must never break the game */ }
}

/** One per page load. */
export function trackVisit() {
  send('visit', {
    w: window.innerWidth, h: window.innerHeight,
    touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    lang: navigator.language,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ref: document.referrer ? new URL(document.referrer).hostname : '',
    returning: device.returning,
  });
}

/** Starts timing a match; call `.end(...)` when it finishes (an unfinished match counts as abandoned). */
export function trackMatch({ mode, difficulty, arena, chars }) {
  const info = { mode, difficulty: mode === '1p' ? difficulty : null, arena, p1: chars[0]?.id, p2: chars[1]?.id };
  const id = uid();
  const t0 = performance.now();
  send('match_start', info, id);
  return {
    end({ winner, rounds }) {
      send('match_end', { ...info, winner, rounds, seconds: (performance.now() - t0) / 1000 }, id);
    },
  };
}
