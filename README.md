# TDP Fighter

A modern 2D fighting game starring 18 friends. Plain HTML5 Canvas and vanilla
JavaScript (ES modules), bundled with Vite. There's no engine and no AI services, and it works offline once loaded. The only
network call is an anonymous usage ping (see **Analytics** below).

All 18 fighters are drawn from hi-res pixel-art pictures (`assets/new_photos/`),
cut into limbs and re-posed for every animation. Arenas, HUD, menus and effects are
smooth vector art with glow, parallax and a gentle zoom camera. Sound is fully
synthesised: layered impacts, reverb, stereo panning, five songs and an announcer.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

`npm run build` makes a static build in `dist/`, which runs from any folder or static
host. A small service worker caches the build so it keeps working offline.

## Menus

- **Title** → **Main menu**: `PLAY` or `SETTINGS`.
- **Play**: choose `1P VS CPU`, `1P VS 2P` or `TOURNAMENT`. Then pick an arena (or Random)
  from a live preview. For 1P vs CPU and the tournament you also pick the difficulty (Easy,
  Normal, Hard or Extreme). Then character select, the VS screen, and the fight.
- **Tournament**: pick your fighter; 7 random rivals complete an 8-fighter bracket.
  Quarter-finals (4 games), semi-finals (2 games), then the final. You play your own
  games; the CPU-vs-CPU games are played for you and revealed on the bracket graph
  (Enter skips the reveal). Lose and you are out (the rest of the bracket still plays out);
  a drawn match is replayed. Code: `src/game/tournament.js` (logic), `src/scenes/bracket.js` (the graph).
- **Extreme** is harder than Hard: near-instant reactions, blocks ~90% of attacks, punishes
  every whiff and jumps out of grabs. Tuned in `CPU_DIFFICULTY` in `src/config.js`.
- **Settings**: `SOUND`, `ANNOUNCER` (the spoken round calls) and `HOW TO PLAY`.
- Back (Esc / X) always goes up one level.
- Every match (including restarts and rematches) opens with a **Get Ready**
  card that shows that mode's buttons and the fighter's special. Press Attack
  to start, or it continues on its own after 6 seconds.

## Controls

| Action  | 1P vs CPU | 2P – Player 1 | 2P – Player 2 |
|---------|-----------|---------------|---------------|
| Move    | ← →       | A D           | ← →           |
| Jump    | ↑         | W             | ↑             |
| Crouch  | ↓         | S             | ↓             |
| Attack  | Z         | F             | K             |
| Defend  | X         | G             | L             |
| Special | C         | H             | ;             |

- Esc / P pauses (resume, restart, character select, main menu). M mutes.
- **Gamepad** (standard mapping): stick or d-pad to move, A jumps, X attacks,
  B or LB defends, Y, RB or RT fires the special, Start pauses. In 2P mode, a
  single gamepad goes to Player 2, so one player can use the keyboard and the
  other the pad.
- **Touch**: on-screen d-pad and ATK / DEF / SPC buttons appear on touch devices.
- All key bindings live in one place: `KEYS` / `PAD` in `src/config.js`.

Rules: best of 3 rounds with a 99-second timer. A crouching attack is a low hit,
so block it crouching. A jump attack is an overhead, so block it standing.
Blocking cuts damage to 15% (25% for specials). Dealing or taking damage fills
the special meter. When it's full, press Special.

## Project layout

```
index.html, src/main.js     canvas, scene manager, fixed-step loop wiring
src/config.js               every tunable: physics, frame data, keys, CPU levels, fighter size (BODY.SCALE)
src/data/characters.js      THE ROSTER (one entry per fighter)
src/game/                   pure game logic (no DOM; runs headless in Node)
  loop.js                   fixed 60 FPS timestep
  input.js                  keyboard / gamepad / touch -> InputState
  fighter.js                per-fighter state machine
  physics.js, collision.js  gravity, walls, pushboxes, hit/hurt boxes
  battle.js                 rounds, timer, hit resolution, hit-stop, KO
  cpu-bot.js                rule-based CPU (FSM + weighted dice; no ML)
  entities.js               projectiles / beams / waves / swarms
  specials/                 one module per special attack (+ registry)
src/render/                 drawing
  puppet.js                 re-poses a hi-res fighter's cut-out limbs from the skeleton poses
  costumes.js               hats, props, scarves... the specials put on a hi-res fighter
  sprites.js                sprite bank: hi-res puppets + the old procedural pixel bodies
  poses.js                  pose skeletons for every animation frame
  backgrounds.js            arenas: one picture per file in assets/arenas/
  battle-render.js          camera (follow + zoom), shadows, floor reflections, entities
  hud.js, effects.js        health bars / banners / cut-in, particles
  ui-kit.js, fx-kit.js      glass panels, glows, smooth shapes for UI and special-attack effects
  font.js, fonts.js         text (Barlow Condensed, shipped in public/fonts)
  post.js                   bloom + vignette over the final picture
src/audio/                  synthesised sound
  synth.js                  layered / filtered / FM tones, noise, thumps, bell rings
  sfx.js                    every sound effect recipe
  music.js                  band sequencer + the songs (menu + one per arena)
  audio.js                  mixer: reverb, stereo pan, ducking, muffle, announcer
src/scenes/                 loading, title (attract demo), menus, select, vs, fight (+ controls card), results
scripts/                    fighter builder, photo resizer, headless tests
tools/                      dev-only pages: poses.html, specials.html, costumes.html, audio.html
```

## How the fighters are drawn

- **Hi-res fighters** (everyone with a picture in `assets/new_photos/<Name>.png`):
  `npm run fighters` (`scripts/build-fighters.mjs`) cuts the magenta backdrop out
  of each picture, then works out which body part every pixel belongs to with a
  flood fill that starts on the bones and stops at the dark outlines, so the cuts
  follow the drawn outlines. Each limb is split at the elbow / knee, joints get
  small overlaps, and whatever a limb hid is painted back in. Nothing is cropped:
  every pixel lands in a part, and the whole picture is also saved uncut
  (`full.webp`) for the menus. Output goes to `public/fighters/<id>/`
  (`atlas.png`, `rig.json`, `portrait.png`, `full.webp`); it is committed, so you
  only need to re-run it when a picture or `scripts/fighter-rigs.mjs` changes.
  At runtime `src/render/puppet.js` poses the parts with the same skeletons as
  everyone else. Idle, walk and crouch keep the arms relaxed as drawn; attacks and
  specials follow the skeleton. Each fighter's on-screen size comes from
  `body.height` in `characters.js` and the global `BODY.SCALE` in `config.js`
  (hitboxes and special-attack origins grow with it).
- Fighters without a picture fall back to the old procedural pixel bodies (`sprites.js`,
  `face-builder.js`, `look` / `body` / `colors` in `characters.js`), so a new roster
  entry works before its art exists.
- **Special attacks** read the real on-screen hand, eye and mouth positions from the
  animation (`f.vis`), so beams, wands, thrown objects and sound waves start where
  the art is. Costumes (hats, props, tints) are drawn as vector art by `costumes.js`.

To see every pose of a fighter: `/tools/poses.html?char=maya`. Every special:
`/tools/specials.html?char=hadar&foe=ido&arena=airport-deck`. Costumes:
`/tools/costumes.html`. Sounds and songs: `/tools/audio.html` (renders everything
offline and reports levels; click to listen).

## Add a 19th character

1. Add a picture `assets/new_photos/<Name>.png` (full body, facing right, relaxed pose,
   on a flat magenta background) and an entry in `RIGS` in `scripts/fighter-rigs.mjs`
   (just the chin height; copy a similar fighter), then `npm run fighters`.
2. Add an entry to `CHARACTERS` in `src/data/characters.js`. Copy an existing
   one and change `id`, `name`, `body.height`, `special` and `bio`.
   `special.type` can reuse any existing special (e.g. `magicBolt`) or a new
   module you add to `src/game/specials/` and register in `specials/index.js`.
3. Without a picture the fighter gets the procedural pixel body from `look` / `body` / `colors`.

## Tests (headless, no browser)

```bash
npm test                         # all of the below
node scripts/test-specials.mjs   # every special vs idle / blocking dummy at 4 ranges
node scripts/simulate.mjs hard 3 # CPU-vs-CPU matches for all 18 (crash / NaN checks)
node scripts/test-difficulty.mjs # easy < normal < hard < extreme win rates
node scripts/test-tournament.mjs # whole tournaments, headless (bracket logic checks)
```

Every special deals 22 damage on hit, or 5.5 when blocked. There are two
deliberate exceptions: Yovel's bugs travel along the ground and must be blocked
crouching, and Yaara's bear hug and Mor's spine choke are grabs, so they can't
be blocked but can be jumped.

In the browser, press <code>`</code> during a fight to show hitboxes.

## Credits

UI font: Barlow Condensed by The Barlow Project Authors, SIL Open Font License 1.1
(`public/fonts/OFL.txt`).

## Analytics and the admin page

The game sends anonymous events (page load, match start, match end) to `api/track.js`,
which stores them in a Neon Postgres database attached to the Vercel project. Nothing
personal is stored: a random id kept in the browser's localStorage (this is what counts
as one "device"), the browser/OS, country/city from Vercel's edge, and what was played.
It is off on localhost and for visitors with Do-Not-Track.

The game itself is served from GitHub Pages; Vercel only hosts the `api/` functions (and
the database). The private dashboard is at `/admin/` (on GitHub Pages or
`tdp-fighter.vercel.app`; both read the same API). It asks for the
`ADMIN_PASSWORD` environment variable (set in Vercel; a copy is in `.env.local`) and
reads `api/stats.js`. To change the password: `vercel env rm ADMIN_PASSWORD` for each
environment, `vercel env add ADMIN_PASSWORD production --sensitive`, then redeploy.
