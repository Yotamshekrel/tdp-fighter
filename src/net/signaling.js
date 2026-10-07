// Client for POST /api/room: swaps the WebRTC handshake between two browsers using a room code.
// The game runs on GitHub Pages and the API on Vercel, so (like analytics) it posts cross-origin as
// text/plain, which needs no CORS preflight. While developing, Vite serves a local copy.
// Some company networks block vercel.app. Deploy worker/ to Cloudflare Workers (see README) and put its
// address here: every player then uses it instead of Vercel (both players must use the same one).
const WORKER_URL = 'https://tdp-fighter-rooms.yotam-tdp-fighter.workers.dev';

const host = location.hostname;
const local = ['localhost', '127.0.0.1', '[::1]'].includes(host);
const sameOrigin = host.endsWith('.vercel.app') || local;
const API = local ? '/api/room' : WORKER_URL || (sameOrigin ? '/api/room' : 'https://tdp-fighter.vercel.app/api/room');

async function call(body) {
  let res;
  try {
    res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) });
  } catch {
    throw new Error(`CAN'T REACH ${new URL(API, location.href).hostname.toUpperCase()}`); // usually a firewall or proxy
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json.error || 'SERVER ERROR').toUpperCase());
  return json;
}

export const createRoom = () => call({ a: 'create' }).then((r) => r.code);
export const joinRoom = (code) => call({ a: 'join', code });
export const sendSignal = (code, role, msg) => call({ a: 'send', code, role, payload: JSON.stringify(msg) });
/** Messages for `role` newer than `after`. */
export async function pollSignals(code, role, after) {
  const r = await call({ a: 'poll', code, role, after });
  return r.msgs.map((m) => ({ id: m.id, msg: JSON.parse(m.payload) }));
}

const STUN_ONLY = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
/** STUN + (if the server has one configured) a TURN relay. Never fails: STUN alone is the fallback. */
export async function getIceServers(code) {
  try {
    const r = await Promise.race([call({ a: 'ice', code }), new Promise((_, no) => setTimeout(no, 4000))]);
    return Array.isArray(r.iceServers) && r.iceServers.length ? r.iceServers : STUN_ONLY;
  } catch {
    return STUN_ONLY;
  }
}
