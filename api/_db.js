// Shared Postgres (Neon) helper for the analytics endpoints.
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
export const sql = url ? neon(url) : null;

let ready;
/** Creates the table on first use, so there is no separate migration step. */
export function ensureSchema() {
  ready ??= (async () => {
    await sql.query(`
      CREATE TABLE IF NOT EXISTS events (
        id         BIGSERIAL PRIMARY KEY,
        ts         TIMESTAMPTZ NOT NULL DEFAULT now(),
        type       TEXT NOT NULL,           -- visit | match_start | match_end
        device_id  TEXT NOT NULL,           -- random id kept in the visitor's localStorage
        session_id TEXT,
        match_id   TEXT,
        host       TEXT,                    -- which site the game was loaded from
        country    TEXT,
        city       TEXT,
        browser    TEXT,
        os         TEXT,
        device     TEXT,                    -- desktop | mobile | tablet
        data       JSONB NOT NULL DEFAULT '{}'
      )`);
    await sql.query('CREATE INDEX IF NOT EXISTS events_ts_idx ON events (ts)');
    await sql.query('CREATE INDEX IF NOT EXISTS events_type_ts_idx ON events (type, ts)');
    await sql.query('CREATE INDEX IF NOT EXISTS events_device_idx ON events (device_id)');
  })().catch((err) => { ready = undefined; throw err; });
  return ready;
}
