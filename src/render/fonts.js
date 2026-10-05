// ---------------------------------------------------------------------------
// The UI font: Barlow Condensed (SIL Open Font License, see public/fonts/OFL.txt),
// shipped with the game so it works offline. Loaded with the FontFace API so the
// canvas can use it; if loading fails the text falls back to a system font.
// ---------------------------------------------------------------------------
export const FONT_FAMILY = '"Barlow Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif';

const FACES = [];
for (const style of ['normal', 'italic']) for (const weight of [500, 600, 700, 800]) FACES.push({ weight, style });

export async function loadFonts(base = './') {
  if (typeof FontFace === 'undefined') return;
  await Promise.all(
    FACES.map(async ({ weight, style }) => {
      try {
        const f = new FontFace('Barlow Condensed', `url(${base}fonts/barlow-condensed-latin-${weight}-${style}.woff2)`, { weight: String(weight), style });
        await f.load();
        document.fonts.add(f);
      } catch {
        /* the system fallback font is used */
      }
    }),
  );
}
