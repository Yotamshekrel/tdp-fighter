// Checks the online-play signaling logic (api/_room-core.js) against the in-memory store:
// a host and a guest swap handshake messages through a room code, and bad requests are refused.
//
//   node scripts/test-room.mjs
import { handleRoom, memoryStore } from '../api/_room-core.js';

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

console.log(failures ? `\n${failures} FAILED` : 'room signaling ok');
process.exit(failures ? 1 : 0);
