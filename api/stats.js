// GET /api/stats - the numbers behind the admin page. Needs `Authorization: Bearer <ADMIN_PASSWORD>`.
import { createHash, timingSafeEqual } from 'node:crypto';
import { sql, ensureSchema } from './_db.js';

const digest = (s) => createHash('sha256').update(String(s)).digest();

function authorised(req) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const given = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return timingSafeEqual(digest(given), digest(expected));
}

const rows = async (text, params = []) => sql.query(text, params);

/** Distinct devices per value of a column (or JSON key) - `col` is always one of our own literals. */
const devicesBy = (col, limit = 12) => rows(
  `SELECT COALESCE(NULLIF(${col}, ''), 'unknown') AS label, count(DISTINCT device_id)::int AS n
   FROM events
   GROUP BY 1 ORDER BY n DESC, label LIMIT ${limit}`,
);
const matchesBy = (key) => rows(
  `SELECT COALESCE(data->>'${key}', 'unknown') AS label, count(*)::int AS n
   FROM events WHERE type = 'match_start' GROUP BY 1 ORDER BY n DESC, label`,
);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).end();
  if (!authorised(req)) {
    await new Promise((r) => setTimeout(r, 1000)); // slow down password guessing
    return res.status(401).json({ error: 'unauthorised' });
  }
  if (!sql) return res.status(503).json({ error: 'database not configured' });

  try {
    await ensureSchema();
    // Days and hours are reported in the admin's own time zone.
    let tz = String(req.query?.tz || 'UTC');
    try { await rows('SELECT now() AT TIME ZONE $1', [tz]); } catch { tz = 'UTC'; }

    const [totals, returning, daily, hourly, modes, difficulties, arenas, picks, wins, vsCpu,
      countries, cities, browsers, systems, deviceTypes, hosts, recentVisits, recentMatches] = await Promise.all([
      rows(`SELECT
          count(DISTINCT device_id)::int AS devices,
          count(DISTINCT device_id) FILTER (WHERE type = 'match_start')::int AS players,
          count(*) FILTER (WHERE type = 'visit')::int AS visits,
          count(*) FILTER (WHERE type = 'match_start')::int AS started,
          count(*) FILTER (WHERE type = 'match_end')::int AS finished,
          count(DISTINCT device_id) FILTER (WHERE ts > now() - interval '5 minutes')::int AS online_now,
          count(DISTINCT device_id) FILTER (WHERE ts > now() - interval '24 hours')::int AS devices_24h,
          count(DISTINCT device_id) FILTER (WHERE ts > now() - interval '7 days')::int AS devices_7d,
          count(DISTINCT device_id) FILTER (WHERE ts > now() - interval '30 days')::int AS devices_30d,
          COALESCE(round(avg((data->>'seconds')::numeric) FILTER (WHERE type = 'match_end')), 0)::int AS avg_seconds,
          COALESCE(round(sum((data->>'seconds')::numeric) FILTER (WHERE type = 'match_end')), 0)::int AS total_seconds,
          min(ts) AS first_event
        FROM events`),
      rows(`SELECT count(*)::int AS n FROM (
          SELECT device_id FROM events WHERE type = 'visit'
          GROUP BY device_id HAVING count(DISTINCT (ts AT TIME ZONE $1)::date) >= 2) t`, [tz]),
      rows(`WITH days AS (
          SELECT generate_series((now() AT TIME ZONE $1)::date - 29, (now() AT TIME ZONE $1)::date, '1 day')::date AS day)
        SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
          count(DISTINCT e.device_id)::int AS devices,
          count(*) FILTER (WHERE e.type = 'visit')::int AS visits,
          count(*) FILTER (WHERE e.type = 'match_start')::int AS matches
        FROM days d LEFT JOIN events e
          ON (e.ts AT TIME ZONE $1)::date = d.day AND e.ts > now() - interval '32 days'
        GROUP BY d.day ORDER BY d.day`, [tz]),
      rows(`SELECT extract(hour FROM ts AT TIME ZONE $1)::int AS hour, count(*)::int AS n
        FROM events WHERE type = 'visit' GROUP BY 1 ORDER BY 1`, [tz]),
      matchesBy('mode'), matchesBy('difficulty'), matchesBy('arena'),
      // Characters picked by a human (side 1 in 1P; both sides in 2P and online).
      rows(`SELECT ch AS id, count(*)::int AS n FROM (
          SELECT data->>'p1' AS ch FROM events WHERE type = 'match_start'
          UNION ALL SELECT data->>'p2' FROM events WHERE type = 'match_start' AND data->>'mode' IN ('2p', 'online')) t
        WHERE ch IS NOT NULL GROUP BY ch ORDER BY n DESC`),
      rows(`SELECT ch AS id, count(*)::int AS played, count(*) FILTER (WHERE won)::int AS won FROM (
          SELECT data->>'p1' AS ch, data->>'winner' = '0' AS won FROM events WHERE type = 'match_end'
          UNION ALL SELECT data->>'p2', data->>'winner' = '1' FROM events WHERE type = 'match_end' AND data->>'mode' IN ('2p', 'online')) t
        WHERE ch IS NOT NULL GROUP BY ch`),
      rows(`SELECT COALESCE(data->>'difficulty', 'unknown') AS label, count(*)::int AS played,
          count(*) FILTER (WHERE data->>'winner' = '0')::int AS won
        FROM events WHERE type = 'match_end' AND data->>'mode' IN ('1p', 'tournament') GROUP BY 1 ORDER BY 1`),
      devicesBy('country'), devicesBy('city'), devicesBy('browser'),
      devicesBy('os'), devicesBy('device'), devicesBy('host'),
      rows(`SELECT ts, left(device_id, 6) AS device, country, city, browser, os, device AS kind, host,
          (data->>'returning')::boolean AS returning
        FROM events WHERE type = 'visit' ORDER BY ts DESC LIMIT 25`),
      rows(`SELECT ts, left(device_id, 6) AS device, data FROM events WHERE type = 'match_end' ORDER BY ts DESC LIMIT 25`),
    ]);

    const wonBy = Object.fromEntries(wins.map((w) => [w.id, w]));
    const t = totals[0];
    return res.status(200).json({
      tz,
      generatedAt: new Date().toISOString(),
      totals: { ...t, returning_devices: returning[0].n, abandoned: Math.max(0, t.started - t.finished) },
      daily, hourly, modes, difficulties, arenas,
      characters: picks.map((p) => ({ id: p.id, picks: p.n, played: wonBy[p.id]?.played ?? 0, won: wonBy[p.id]?.won ?? 0 })),
      vsCpu, countries, cities, browsers, systems, deviceTypes, hosts, recentVisits, recentMatches,
    });
  } catch (err) {
    console.error('stats failed', err);
    return res.status(500).json({ error: 'server error' });
  }
}
