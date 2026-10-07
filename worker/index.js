// Online-play signaling on Cloudflare Workers: the same API as api/room.js (Vercel), for networks that
// block vercel.app. One Durable Object per room code holds the few handshake messages for ~15 minutes.
//
// Optional secrets for a TURN relay (see api/_ice.js):  npx wrangler secret put CF_TURN_KEY_ID
//                                                         npx wrangler secret put CF_TURN_API_TOKEN
import { DurableObject } from 'cloudflare:workers';
import { handleRoom, CODE_RE, ROOM_TTL_MS } from '../api/_room-core.js';
import { iceServers } from '../api/_ice.js';

export class Room extends DurableObject {
  async #load() {
    return (await this.ctx.storage.get('room')) ?? null;
  }
  async create() {
    if (await this.#load()) return false;
    await this.ctx.storage.put('room', { createdAt: Date.now(), joined: false, seq: 0, msgs: [] });
    await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
    return true;
  }
  async get() {
    const r = await this.#load();
    return r && { createdAt: r.createdAt, joined: r.joined };
  }
  async join() {
    const r = await this.#load();
    r.joined = true;
    await this.ctx.storage.put('room', r);
  }
  async add(to, payload) {
    const r = await this.#load();
    const id = ++r.seq;
    r.msgs.push({ id, to, payload });
    await this.ctx.storage.put('room', r);
    return id;
  }
  async msgs(to, after) {
    const r = await this.#load();
    return r.msgs.filter((m) => m.to === to && m.id > after).map(({ id, payload }) => ({ id, payload }));
  }
  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (req.method === 'GET') return new Response('tdp-fighter rooms ok', { headers: CORS }); // a link a friend can open to test the network
    if (req.method !== 'POST') return new Response(null, { status: 405, headers: CORS });

    let body = null;
    try { body = JSON.parse(await req.text()); } catch { /* bad body */ }

    const room = (code) => env.ROOMS.get(env.ROOMS.idFromName(code));
    const store = {
      createRoom: (code) => room(code).create(),
      getRoom: (code) => room(code).get(),
      markJoined: (code) => room(code).join(),
      addMsg: (code, to, payload) => room(code).add(to, payload),
      getMsgs: (code, to, after) => room(code).msgs(to, after),
      sweep: async () => {}, // each room deletes itself with an alarm
    };

    if (body?.a === 'ice') {
      const code = typeof body.code === 'string' ? body.code.toUpperCase() : '';
      const found = CODE_RE.test(code) ? await store.getRoom(code) : null;
      if (!found || Date.now() - found.createdAt > ROOM_TTL_MS) return json(404, { error: 'room not found' });
      return json(200, { iceServers: await iceServers(env) });
    }
    try {
      const { status, json: out } = await handleRoom(store, body);
      return json(status, out);
    } catch (err) {
      console.error('room failed', err);
      return json(500, { error: 'server error' });
    }
  },
};
