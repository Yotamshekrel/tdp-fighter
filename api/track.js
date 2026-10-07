// POST /api/track - receives anonymous usage events from the game.
// Stores no IP address: only a random per-browser id, plus coarse country/city from the edge headers.
import { sql, ensureSchema } from './_db.js';

const TYPES = new Set(['visit', 'match_start', 'match_end']);
const ID = /^[\w-]{8,64}$/;
const SLUG = /^[a-z0-9_-]{1,24}$/;

const str = (v, max = 64) => (typeof v === 'string' && v ? v.slice(0, max) : null);
const slug = (v) => (typeof v === 'string' && SLUG.test(v) ? v : null);
const num = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : null);

function parseUA(ua = '') {
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\/|Opera/.test(ua) ? 'Opera' :
    /SamsungBrowser/.test(ua) ? 'Samsung Internet' :
    /Firefox\/|FxiOS/.test(ua) ? 'Firefox' :
    /Chrome\/|CriOS/.test(ua) ? 'Chrome' :
    /Safari\//.test(ua) ? 'Safari' : 'Other';
  const os =
    /Windows/.test(ua) ? 'Windows' :
    /Android/.test(ua) ? 'Android' :
    /iPhone|iPad|iPod/.test(ua) ? 'iOS' :
    /Mac OS X|Macintosh/.test(ua) ? 'macOS' :
    /CrOS/.test(ua) ? 'ChromeOS' :
    /Linux/.test(ua) ? 'Linux' : 'Other';
  const device = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? 'tablet'
    : /Mobi|iPhone|Android/.test(ua) ? 'mobile' : 'desktop';
  return { browser, os, device };
}

function cleanData(type, d = {}) {
  const base = { v: str(d.v, 16) };
  if (type === 'visit') {
    return {
      ...base,
      w: num(d.w, 0, 10000), h: num(d.h, 0, 10000),
      touch: d.touch === true,
      lang: str(d.lang, 16), tz: str(d.tz, 48),
      ref: str(d.ref, 80),
      returning: d.returning === true,
    };
  }
  const match = {
    ...base,
    mode: ['1p', '2p', 'online', 'tournament'].includes(d.mode) ? d.mode : null,
    difficulty: ['easy', 'normal', 'hard', 'extreme'].includes(d.difficulty) ? d.difficulty : null,
    arena: slug(d.arena),
    p1: slug(d.p1), p2: slug(d.p2),
  };
  if (type === 'match_start') return match;
  return {
    ...match,
    winner: [0, 1, -1].includes(d.winner) ? d.winner : null,       // side that won, -1 = draw
    seconds: num(d.seconds, 0, 3600),
    rounds: num(d.rounds, 0, 9),
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*'); // the GitHub Pages copy of the game posts here too
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!sql) return res.status(503).json({ error: 'database not configured' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'bad body' });

  const { type, device_id: deviceId } = body;
  if (!TYPES.has(type) || typeof deviceId !== 'string' || !ID.test(deviceId)) {
    return res.status(400).json({ error: 'bad event' });
  }
  const sessionId = typeof body.session_id === 'string' && ID.test(body.session_id) ? body.session_id : null;
  const matchId = typeof body.match_id === 'string' && ID.test(body.match_id) ? body.match_id : null;

  const ua = parseUA(req.headers['user-agent']);
  const country = str(req.headers['x-vercel-ip-country'], 2);
  let city = req.headers['x-vercel-ip-city'];
  try { city = str(decodeURIComponent(city || ''), 64); } catch { city = null; }

  try {
    await ensureSchema();
    await sql.query(
      `INSERT INTO events (type, device_id, session_id, match_id, host, country, city, browser, os, device, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [type, deviceId, sessionId, matchId, str(body.host, 80), country, city, ua.browser, ua.os, ua.device,
        JSON.stringify(cleanData(type, body.data))],
    );
    return res.status(204).end();
  } catch (err) {
    console.error('track failed', err);
    return res.status(500).json({ error: 'server error' });
  }
}
