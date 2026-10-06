// ---------------------------------------------------------------------------
// Arenas: one painted background per image in assets/arenas/.
//
// The file name is the arena's name ("Airport Lobby.png" -> "Airport Lobby"),
// so adding or renaming a picture in that folder is all it takes to change
// the arena list. Pictures are 16:9 and fill the whole view.
// ---------------------------------------------------------------------------
import { VIEW } from '../config.js';

const { W, H } = VIEW;

const files = import.meta.glob('../../assets/arenas/*.png', { eager: true, query: '?url', import: 'default' });

/** Per-arena extras, keyed by id; anything not listed gets the defaults below. */
const TRAITS = {
  'airport-deck': { music: 'fight_stadium', reflect: 0.1 },
  'airport-classroom': { music: 'fight_rooftop', reflect: 0.04 },
  'airport-kitchen': { music: 'fight_shuk', reflect: 0.07 },
  'airport-lobby': { music: 'fight_beach', reflect: 0.12 },
};
const DEFAULTS = { music: 'fight', reflect: 0.06 };

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const ARENAS = Object.entries(files)
  .map(([path, url]) => {
    const name = path.split('/').pop().replace(/\.png$/i, '');
    const id = slug(name);
    const img = new Image();
    img.src = url;
    return { id, name, img, ...DEFAULTS, ...TRAITS[id] };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

for (const a of ARENAS) a.draw = (g) => drawBackdrop(g, a);

function drawBackdrop(g, a) {
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(a.img, 0, 0, W, H);
}

/** Resolves once every arena picture has loaded (call during the loading screen). */
export function loadArenas() {
  return Promise.all(ARENAS.map((a) => a.img.decode().catch(() => {})));
}

export function getArena(id) {
  return ARENAS.find((x) => x.id === id) || ARENAS[0];
}

/** Draw an arena. camX is unused: the picture is fixed to the world, the camera pans and zooms over it. */
export function drawArena(g, arena, t, camX = 0, dim = 0) {
  arena.draw(g, t, camX);
  if (dim > 0) {
    g.fillStyle = `rgba(0, 0, 0, ${dim})`;
    g.fillRect(camX, 0, W, H);
  }
}
export const lerp = (a, b, t) => a + (b - a) * t;
