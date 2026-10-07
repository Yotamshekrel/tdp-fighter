// The ICE servers (STUN + optional TURN relay) a browser needs to connect to the other player.
//
// STUN alone connects most home networks. A strict network (company proxy, firewall that blocks UDP)
// needs a TURN relay. Set ONE of these in the Vercel project's environment variables:
//
//   Cloudflare Realtime TURN (short-lived credentials are minted per request):
//     CF_TURN_KEY_ID, CF_TURN_API_TOKEN
//   Any other TURN service (Metered, Twilio, your own coturn), with fixed credentials:
//     TURN_URLS (comma separated, e.g. "turn:host:3478,turns:host:443?transport=tcp"), TURN_USERNAME, TURN_CREDENTIAL
//
// With neither set, only STUN is returned and the game works exactly as before.
const STUN = { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] };
const TTL_SECONDS = 4 * 60 * 60; // longer than any one match

export async function iceServers(env = process.env) {
  const servers = [STUN];
  try {
    if (env.CF_TURN_KEY_ID && env.CF_TURN_API_TOKEN) {
      const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.CF_TURN_KEY_ID}/credentials/generate-ice-servers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.CF_TURN_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: TTL_SECONDS }),
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) throw new Error(`cloudflare ${res.status}`);
      const body = await res.json();
      // Cloudflare's own STUN is included in its answer; keep only entries that carry credentials.
      for (const s of body.iceServers ?? []) if (s.username && s.credential) servers.push(s);
    } else if (env.TURN_URLS && env.TURN_USERNAME && env.TURN_CREDENTIAL) {
      servers.push({ urls: env.TURN_URLS.split(',').map((u) => u.trim()).filter(Boolean), username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL });
    }
  } catch (err) {
    console.error('ice failed (falling back to STUN only)', err.message);
  }
  return servers;
}
