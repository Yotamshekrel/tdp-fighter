// TAL — "Reply All": fires off emails and meeting invites at the other fighter. A "NEW EMAIL" ping,
// then four envelopes (Re: Re: Fwd:) shoot out of her phone straight at them, and since an inbox is
// never enough, two calendar invites drop out of the sky: a quick sync, then a 3-hour ALL-HANDS that
// slams down and can't be declined.
import { Entity } from '../entities.js';
import { spHit, SD, handPos, bodyCenter, clamp, VIEW, SC } from './helpers.js';
import { inked, lingrad, bloomAt, INK } from '../../render/fx-kit.js';
import { drawText } from '../../render/font.js';
import { rand } from '../rng.js';

const MAILS = [
  { tag: 'RE:', col: '#ffffff' },
  { tag: 'FWD:', col: '#fff1c4' },
  { tag: 'URGENT', col: '#ffd0d0' },
  { tag: 'RE: RE:', col: '#d6ecff' },
];
const MAIL_EVERY = 9;
const MEETINGS = [
  { title: 'QUICK SYNC', time: '9:00 - 9:15', col: '#2f6df0', col2: '#1a3a90', big: false },
  { title: 'ALL-HANDS', time: '9:00 - 12:00', col: '#e8502a', col2: '#9a2210', big: true },
];
const MEET_AT = MAILS.length * MAIL_EVERY + 14; // the invites follow the last email
const MEET_EVERY = 22;
const MAIL_DMG = SD * 0.1;
const SYNC_DMG = SD * 0.15;
const ALLHANDS_DMG = SD - MAIL_DMG * MAILS.length - SYNC_DMG;
const GROUND = VIEW.GROUND_Y;

export default {
  windup: 30,
  duration: 128,
  aiRange: [0, 999],
  anim(f, t) {
    if (t < this.windup) return { pose: 'raise', frame: Math.floor(t / 6) % 2 }; // thumbing at the phone
    const k = t - this.windup;
    return { pose: k < MEET_AT ? 'throw' : 'cast', frame: k % MAIL_EVERY < 4 ? 1 : 0 };
  },

  start(f, b) {
    b.fx.text('CHECK YOUR INBOX!', f.x, f.y - 98 * f.scale, { color: ['#ffffff', '#7fb2ff'], life: 46 });
    b.sfx('charge', f.x);
  },

  update(f, b, t, opp) {
    const s = f.sd;
    if (t === this.windup - 10) b.sfx('magic', opp.x); // the notification ping
    if (t < this.windup) return;
    const k = t - this.windup;
    s.n = s.n || 0;
    s.m = s.m || 0;
    if (s.n < MAILS.length && k % MAIL_EVERY === 2) {
      sendMail(f, b, opp, MAILS[s.n]);
      s.n++;
    } else if (s.n === MAILS.length && s.m < MEETINGS.length && k >= MEET_AT + s.m * MEET_EVERY) {
      s.last = sendMeeting(f, b, opp, MEETINGS[s.m]);
      if (MEETINGS[s.m].big) b.fx.text('ACCEPT? NO CHOICE.', f.x, f.y - 98 * f.scale, { bubble: true, life: 40 });
      s.m++;
    }
    if (s.m === MEETINGS.length && s.last && s.last.dead) f.endSpecial(b);
  },

  draw(ctx, f, b, t) {
    const opp = b.opponentOf(f);
    // the phone in her hand
    const h = f.vis?.hand ? handPos(f) : null;
    if (h) {
      ctx.save();
      ctx.translate(h.x, h.y - 4);
      ctx.rotate(-0.2 * f.facing);
      ctx.scale(f.facing * 0.9, 0.9);
      inked(ctx, '#20242e', (c) => c.roundRect(-3.6, -7, 7.2, 13, 1.2), 0.7);
      ctx.fillStyle = lingrad(ctx, 0, -6, 0, 5, [[0, '#6fb0ff'], [1, '#2a58c8']]);
      ctx.fillRect(-2.8, -5.8, 5.6, 10.6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1.8, -3.4, 3.6, 2.4);
      ctx.restore();
    }
    // the notification toast pops up over the opponent's head
    if (opp && t >= this.windup - 10 && t < this.windup + 10) {
      const k = t - (this.windup - 10);
      const pop = Math.min(1, k / 6);
      const fade = clamp((this.windup + 10 - t) / 6, 0, 1);
      const x = opp.x, y = opp.y - 128 * opp.scale;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(x, y - (1 - pop) * 10);
      ctx.scale(pop, pop);
      const w = 74, hgt = 20;
      inked(ctx, '#f6f8ff', (c) => c.roundRect(-w / 2, -hgt / 2, w, hgt, 3), 1);
      ctx.fillStyle = '#e8502a';
      ctx.fillRect(-w / 2 + 2, -hgt / 2 + 2, 3, hgt - 4);
      drawText(ctx, 'NEW EMAIL FROM TAL', 3, -hgt / 2 + 3, { scale: 0.7, align: 'center', color: '#14101e', weight: 800, italic: false });
      drawText(ctx, 'RE: RE: RE: FWD: YOU', 3, 2, { scale: 0.6, align: 'center', color: '#d01830', weight: 700, italic: false });
      ctx.fillStyle = '#ff2a3a'; // unread badge
      ctx.beginPath(); ctx.arc(w / 2 - 1, -hgt / 2 + 1, 4, 0, 6.3); ctx.fill();
      drawText(ctx, '99', w / 2 - 1, -hgt / 2 - 2.2, { scale: 0.55, align: 'center', color: '#ffffff', weight: 800, italic: false });
      ctx.restore();
    }
  },
};

/** One envelope flying out of her hand, straight at the opponent. */
function sendMail(f, b, opp, mail) {
  const h = handPos(f, -64);
  const c = bodyCenter(opp);
  const T = clamp(Math.abs(c.x - h.x) / 7, 10, 30);
  const jitter = (rand() - 0.5) * 10;
  b.sfx('throw', f.x);
  return b.spawn(new Entity({
    owner: f, x: h.x, y: h.y - 2 * SC, vx: (c.x - h.x) / T, vy: (c.y + jitter - h.y) / T, w: 14 * SC, h: 10 * SC, life: 90, vscale: SC,
    spin: 0,
    hit: spHit({ damage: MAIL_DMG, hitstun: 16, blockstun: 11, push: 1.4, hitstop: 5, sfx: 'bonk' }),
    onUpdate(e) { e.angle = Math.sin(e.t * 0.5) * 0.12; },
    onHit(e, bb) { poof(bb, e.x, e.y, false); },
    draw(ctx, e) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle);
      ctx.scale(f.facing * 1.45, 1.45);
      envelope(ctx, mail);
      ctx.restore();
    },
  }));
}

/** A calendar invite dropping onto the opponent (the last one is the big knockdown). */
function sendMeeting(f, b, opp, meeting) {
  const big = meeting.big;
  const k = big ? 1.25 : 1.1;
  const w = 40 * k * SC, h = 36 * k * SC;
  b.sfx('throw', f.x);
  return b.spawn(new Entity({
    owner: f, x: opp.x + (rand() - 0.5) * 30, y: big ? -40 : -24, vy: big ? 4.6 : 5.2, gravity: big ? 0.34 : 0.3,
    w: w * 0.8, h: h * 0.8, life: 130, vscale: SC, spin: 0,
    hit: spHit(big
      ? { damage: ALLHANDS_DMG, hitstun: 26, blockstun: 16, push: 5, hitstop: 12, knockdown: true, shake: 5, sfx: 'smash' }
      : { damage: SYNC_DMG, hitstun: 18, blockstun: 12, push: 1.5, hitstop: 6, sfx: 'bonk' }),
    onUpdate(e, bb) {
      const o = bb.opponentOf(f);
      if (o && e.y < GROUND - 70) e.vx = clamp((o.x - e.x) * 0.08, -2, 2);
      else e.vx *= 0.8;
    },
    onHit(e, bb) { poof(bb, e.x, e.y, big, meeting.col); },
    onGround(e, bb) { e.dead = true; poof(bb, e.x, e.y + 4, big, meeting.col); },
    draw(ctx, e) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.scale(k, k);
      invite(ctx, meeting, e.t);
      ctx.restore();
    },
  }));
}

function poof(b, x, y, big, col = '#ffffff') {
  b.fx.burst('confetti', x, y, big ? 18 : 8, { colors: [col, '#ffffff', '#ffd23f'], speed: big ? 3.6 : 2.4, g: 0.12, life: big ? 34 : 22 });
  b.sfx(big ? 'coin' : 'bonk', x);
  if (big) b.fx.text('MEETING COULD HAVE BEEN AN EMAIL', clamp(x, 120, VIEW.W - 120), y - 36, { color: ['#fff6a0', '#ffd23f'], life: 46 });
}

/** An envelope, ~14 x 10 units, centred on (0, 0), with a tag stamped on it. */
function envelope(c, mail) {
  bloomAt(c, 0, 0, 12, '#ffffff', 0.2);
  inked(c, lingrad(c, 0, -5, 0, 5, [[0, mail.col], [1, '#c4cce0']]), (p) => p.roundRect(-7, -5, 14, 10, 1), 0.8);
  c.strokeStyle = INK;
  c.lineWidth = 0.6;
  c.beginPath(); // the flap
  c.moveTo(-6.6, -4.6); c.lineTo(0, 1); c.lineTo(6.6, -4.6);
  c.stroke();
  c.fillStyle = '#e8402a'; // the red unread dot
  c.beginPath(); c.arc(6, -4.6, 2, 0, 6.3); c.fill();
  drawText(c, mail.tag, 0, 1.2, { scale: 0.4, align: 'center', color: '#14101e', weight: 800, italic: false });
}

/** A calendar invite, ~40 x 36 units, centred on (0, 0): colour header, title, time, a blocked-out grid and a greyed DECLINE. */
function invite(c, m, t) {
  const x0 = -20, y0 = -18, w = 40, h = 36;
  bloomAt(c, 0, 0, m.big ? 34 : 28, m.col, 0.25);
  inked(c, lingrad(c, 0, y0, 0, y0 + h, [[0, '#ffffff'], [1, '#e4e8f4']]), (p) => p.roundRect(x0, y0, w, h, 1.8), 1);
  c.fillStyle = lingrad(c, 0, y0, 0, y0 + 9, [[0, m.col], [1, m.col2]]);
  c.fillRect(x0 + 0.5, y0 + 0.5, w - 1, 8.5);
  drawText(c, 'MEETING INVITE', x0 + 3, y0 + 1.6, { scale: 0.52, color: 'rgba(255,255,255,0.8)', weight: 700, italic: false });
  drawText(c, m.title, x0 + 3, y0 + 4.6, { scale: 0.8, color: '#ffffff', weight: 800, italic: false });
  drawText(c, m.time, x0 + 3, y0 + 11.4, { scale: 0.62, color: '#14101e', weight: 800, italic: false });
  // the day, with every slot already booked
  for (let i = 0; i < 4; i++) {
    c.fillStyle = i === 2 && t % 8 < 4 ? '#ff4a5a' : m.col;
    c.globalAlpha = 0.28 + 0.14 * i;
    c.fillRect(x0 + 3 + i * 8.6, y0 + 16.4, 7.6, 7);
    c.globalAlpha = 1;
  }
  drawText(c, '+ 14 ATTENDEES', x0 + 3, y0 + 25, { scale: 0.5, color: '#4a5270', weight: 700, italic: false });
  // ACCEPT lit up, DECLINE greyed out
  c.fillStyle = '#1fa874';
  c.fillRect(x0 + 3, y0 + h - 7.2, 16, 4.6);
  drawText(c, 'ACCEPT', x0 + 11, y0 + h - 6.4, { scale: 0.52, align: 'center', color: '#ffffff', weight: 800, italic: false });
  c.fillStyle = '#c8cde0';
  c.fillRect(x0 + 21, y0 + h - 7.2, 16, 4.6);
  drawText(c, 'DECLINE', x0 + 29, y0 + h - 6.4, { scale: 0.52, align: 'center', color: '#8e96b0', weight: 800, italic: false });
}
