// POST /api/room - signaling for online play (see _room-core.js). Rooms live in Neon for ~15 minutes.
// Only the WebRTC handshake goes through here; the fight itself runs browser to browser.
import { sql } from './_db.js';
import { handleRoom, CODE_RE, ROOM_TTL_MS } from './_room-core.js';
import { iceServers } from './_ice.js';

let ready;
function ensureRoomSchema() {
  ready ??= (async () => {
    await sql.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        code       TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        joined     BOOLEAN NOT NULL DEFAULT false
      )`);
    await sql.query(`
      CREATE TABLE IF NOT EXISTS room_msgs (
        id      BIGSERIAL PRIMARY KEY,
        code    TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
        to_role TEXT NOT NULL,
        payload TEXT NOT NULL
      )`);
    await sql.query('CREATE INDEX IF NOT EXISTS room_msgs_code_idx ON room_msgs (code, to_role, id)');
  })().catch((err) => { ready = undefined; throw err; });
  return ready;
}

const store = {
  async createRoom(code) {
    const r = await sql.query('INSERT INTO rooms (code) VALUES ($1) ON CONFLICT DO NOTHING RETURNING code', [code]);
    return r.length > 0;
  },
  async getRoom(code) {
    const r = await sql.query('SELECT extract(epoch from created_at) * 1000 AS ms, joined FROM rooms WHERE code = $1', [code]);
    return r[0] && { createdAt: Number(r[0].ms), joined: r[0].joined };
  },
  async markJoined(code) {
    await sql.query('UPDATE rooms SET joined = true WHERE code = $1', [code]);
  },
  async addMsg(code, to, payload) {
    const r = await sql.query('INSERT INTO room_msgs (code, to_role, payload) VALUES ($1,$2,$3) RETURNING id', [code, to, payload]);
    return Number(r[0].id);
  },
  async getMsgs(code, to, after) {
    const r = await sql.query('SELECT id, payload FROM room_msgs WHERE code = $1 AND to_role = $2 AND id > $3 ORDER BY id', [code, to, after]);
    return r.map((m) => ({ id: Number(m.id), payload: m.payload }));
  },
  async sweep(maxAgeMs) {
    await sql.query("DELETE FROM rooms WHERE created_at < now() - ($1 || ' milliseconds')::interval", [String(maxAgeMs)]);
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*'); // the GitHub Pages copy of the game posts here
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!sql) return res.status(503).json({ error: 'database not configured' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }

  try {
    await ensureRoomSchema();
    if (body?.a === 'ice') {
      // Only people holding a live room code get relay credentials, so the endpoint cannot be used to burn the quota.
      const code = typeof body.code === 'string' ? body.code.toUpperCase() : '';
      const room = CODE_RE.test(code) ? await store.getRoom(code) : null;
      res.setHeader('Cache-Control', 'no-store');
      if (!room || Date.now() - room.createdAt > ROOM_TTL_MS) return res.status(404).json({ error: 'room not found' });
      return res.status(200).json({ iceServers: await iceServers() });
    }
    const { status, json } = await handleRoom(store, body);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(status).json(json);
  } catch (err) {
    console.error('room failed', err);
    return res.status(500).json({ error: 'server error' });
  }
}
