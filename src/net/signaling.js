// Client for POST /api/room: swaps the WebRTC handshake between two browsers using a room code.
// The game runs on GitHub Pages and the API on Vercel, so (like analytics) it posts cross-origin as
// text/plain, which needs no CORS preflight. While developing, Vite serves a local copy.
const host = location.hostname;
const sameOrigin = host.endsWith('.vercel.app') || ['localhost', '127.0.0.1', '[::1]'].includes(host);
const API = sameOrigin ? '/api/room' : 'https://tdp-fighter.vercel.app/api/room';

async function call(body) {
  let res;
  try {
    res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) });
  } catch {
    throw new Error('CAN\'T REACH THE SERVER');
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
