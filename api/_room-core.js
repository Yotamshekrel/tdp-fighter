// Signaling logic for online play, independent of where rooms are stored.
//
// Two browsers use a short room code to swap the WebRTC handshake messages (offer, answer, ICE
// candidates). Once their data channel is open nothing else goes through the server, so a room is
// only ever a handful of tiny rows that live a few minutes.
//
//   create                       -> { code }               the host asks for a fresh room
//   join   { code }              -> { ok }                 the guest checks the room exists and claims it
//   send   { code, role, payload } -> { id }               leave a message for the *other* role
//   poll   { code, role, after } -> { msgs: [{id, payload}], joined }   messages for this role newer than `after`
//
// A store implements: createRoom(code), getRoom(code), markJoined(code), addMsg(code, to, payload),
// getMsgs(code, to, after), sweep(maxAgeMs). See room.js (Neon) and the dev server (memory).

export const ROOM_TTL_MS = 15 * 60 * 1000;
export const MAX_PAYLOAD = 8000;
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O
export const CODE_RE = /^[A-HJ-NP-Z]{4}$/;

const randomCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
const bad = (error, status = 400) => ({ status, json: { error } });

export async function handleRoom(store, body) {
  if (!body || typeof body !== 'object') return bad('bad body');
  const { a: action } = body;
  const code = typeof body.code === 'string' ? body.code.toUpperCase() : '';

  if (action === 'create') {
    await store.sweep(ROOM_TTL_MS);
    for (let i = 0; i < 20; i++) {
      const c = randomCode();
      if (await store.createRoom(c)) return { status: 200, json: { code: c } };
    }
    return bad('no free room code, try again', 503);
  }

  if (!CODE_RE.test(code)) return bad('bad code');
  const room = await store.getRoom(code);
  if (!room || Date.now() - room.createdAt > ROOM_TTL_MS) return bad('room not found', 404);

  if (action === 'join') {
    if (room.joined) return bad('room is full', 409);
    await store.markJoined(code);
    return { status: 200, json: { ok: true } };
  }

  const role = body.role === 'host' ? 'host' : body.role === 'guest' ? 'guest' : null;
  if (!role) return bad('bad role');

  if (action === 'send') {
    const payload = typeof body.payload === 'string' ? body.payload : '';
    if (!payload || payload.length > MAX_PAYLOAD) return bad('bad payload');
    const id = await store.addMsg(code, role === 'host' ? 'guest' : 'host', payload);
    return { status: 200, json: { id } };
  }

  if (action === 'poll') {
    const after = Number.isFinite(body.after) ? body.after : 0;
    const msgs = await store.getMsgs(code, role, after);
    return { status: 200, json: { msgs, joined: room.joined } };
  }

  return bad('bad action');
}

/** In-memory store, used by the Vite dev server and the tests. */
export function memoryStore() {
  const rooms = new Map();
  let seq = 0;
  return {
    async createRoom(code) {
      if (rooms.has(code)) return false;
      rooms.set(code, { createdAt: Date.now(), joined: false, msgs: [] });
      return true;
    },
    async getRoom(code) {
      const r = rooms.get(code);
      return r && { createdAt: r.createdAt, joined: r.joined };
    },
    async markJoined(code) { rooms.get(code).joined = true; },
    async addMsg(code, to, payload) {
      const id = ++seq;
      rooms.get(code).msgs.push({ id, to, payload });
      return id;
    },
    async getMsgs(code, to, after) {
      return rooms.get(code).msgs.filter((m) => m.to === to && m.id > after).map(({ id, payload }) => ({ id, payload }));
    },
    async sweep(maxAge) {
      for (const [c, r] of rooms) if (Date.now() - r.createdAt > maxAge) rooms.delete(c);
    },
  };
}
