// Checks the online-play signaling logic (api/_room-core.js) against the in-memory store:
// a host and a guest swap handshake messages through a room code, and bad requests are refused.
//
//   node scripts/test-room.mjs
import { handleRoom, memoryStore } from '../api/_room-core.js';
import { iceServers } from '../api/_ice.js';

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  !! ' + msg); } };
const store = memoryStore();
const call = (body) => handleRoom(store, body);

const { status, json } = await call({ a: 'create' });
check(status === 200 && /^[A-HJ-NP-Z]{4}$/.test(json.code), 'create gives a 4-letter code without I or O');
const code = json.code;

check((await call({ a: 'join', code: 'ZZZZ' })).status === 404, 'joining an unknown room is a 404');
check((await call({ a: 'join', code: 'ab1' })).status === 400, 'a malformed code is refused');
check((await call({ a: 'poll', code, role: 'host', after: 0 })).json.joined === false, 'room starts unjoined');

check((await call({ a: 'join', code: code.toLowerCase() })).status === 200, 'the first join works (any letter case)');
check((await call({ a: 'join', code })).status === 409, 'a second guest is told the room is full');
check((await call({ a: 'poll', code, role: 'host', after: 0 })).json.joined === true, 'the host can see the guest joined');

// messages go to the other side only, in order, and only the new ones are returned
await call({ a: 'send', code, role: 'guest', payload: '{"t":"hello"}' });
await call({ a: 'send', code, role: 'host', payload: '{"t":"offer"}' });
await call({ a: 'send', code, role: 'host', payload: '{"t":"ice"}' });
let r = (await call({ a: 'poll', code, role: 'host', after: 0 })).json.msgs;
check(r.length === 1 && r[0].payload === '{"t":"hello"}', 'the host only sees what the guest sent');
r = (await call({ a: 'poll', code, role: 'guest', after: 0 })).json.msgs;
check(r.length === 2 && r[0].id < r[1].id && r[0].payload === '{"t":"offer"}', 'the guest sees the host messages in order');
r = (await call({ a: 'poll', code, role: 'guest', after: r[0].id })).json.msgs;
check(r.length === 1 && r[0].payload === '{"t":"ice"}', 'polling with `after` returns only newer messages');

check((await call({ a: 'send', code, role: 'host', payload: 'x'.repeat(9000) })).status === 400, 'huge payloads are refused');
check((await call({ a: 'send', code, role: 'nobody', payload: 'x' })).status === 400, 'an unknown role is refused');
check((await call({ a: 'bogus', code })).status === 400, 'an unknown action is refused');
check((await call(null)).status === 400, 'a missing body is refused');

const codes = new Set();
for (let i = 0; i < 50; i++) codes.add((await call({ a: 'create' })).json.code);
check(codes.size === 50, 'fifty rooms get fifty different codes');

// ICE servers: STUN always; a TURN relay when configured (static credentials or Cloudflare)
let ice = await iceServers({});
check(ice.length === 1 && !ice[0].username, 'with nothing configured only STUN is returned');
ice = await iceServers({ TURN_URLS: 'turn:t.example:3478, turns:t.example:443?transport=tcp', TURN_USERNAME: 'u', TURN_CREDENTIAL: 'p' });
check(ice.length === 2 && ice[1].urls.length === 2 && ice[1].username === 'u' && ice[1].credential === 'p', 'static TURN settings are passed through');
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const ok = url.includes('/keys/KEY/') && opts.headers.Authorization === 'Bearer TOK' && JSON.parse(opts.body).ttl > 0;
  return { ok, status: ok ? 200 : 401, json: async () => ({ iceServers: [{ urls: ['stun:stun.cloudflare.com:3478'] }, { urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'], username: 'cu', credential: 'cp' }] }) };
};
ice = await iceServers({ CF_TURN_KEY_ID: 'KEY', CF_TURN_API_TOKEN: 'TOK' });
check(ice.length === 2 && ice[1].username === 'cu' && ice[1].urls.some((u) => u.startsWith('turns:')), 'Cloudflare credentials are minted and the TURN entry kept');
ice = await iceServers({ CF_TURN_KEY_ID: 'KEY', CF_TURN_API_TOKEN: 'BAD' });
check(ice.length === 1, 'if Cloudflare refuses, the game still gets STUN');
globalThis.fetch = realFetch;

console.log(failures ? `\n${failures} FAILED` : 'room signaling ok');
process.exit(failures ? 1 : 0);
