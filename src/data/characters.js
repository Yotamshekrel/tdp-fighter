// ---------------------------------------------------------------------------
// THE ROSTER. Everything about a character lives here.
//
// To add another fighter:
//   1. drop a photo in assets/photos/<Name>.jpg  (any of .jpg/.jpeg/.png)
//   2. add an entry below. `special.type` can reuse any existing special
//      (see src/game/specials/index.js) or point to a new one.
// That's it. No photo? You still get a pixel face from `look` (or a generic
// silhouette if there's no `look` either), so the game never crashes.
//
// Fields
//   isNew     optional: true shows a NEW badge on the select screen
//   id        unique, lowercase; photo is loaded from photos/<id>.jpg
//   name      shown in menus/HUD (keep it short)
//   face      face crop in the photo, normalised 0..1 { x, y, h } (centre +
//             box height). Used to sample skin tone, or - if a fighter has
//             no `look` - to build a pixelated-photo head instead.
//   (hi-res art)  a fighter with a picture in assets/new_photos/<Name>.png is drawn from that
//             picture (public/fighters/<id>/, built by scripts/build-fighters.mjs, posed by
//             src/render/puppet.js). It replaces the look/body/colors drawing below.
//   look      the pixel-art face (see src/render/face-builder.js):
//             skin, hair ('short' | 'fade' | 'quiff' | 'sidepart' | 'curly' |
//             'messy' | 'wavy' | 'longStraight' | 'longWavy' | 'longCurly'),
//             hairColor, hairColor2 (ombre), eyes, brows (1|2),
//             beard (null | 'stubble' | 'short' | 'full'), beardColor,
//             mouth ('grin' | 'smile'), lips, glasses, earring, jaw, female
//   body      the fighter's own body (see src/render/sprites.js):
//             build ('slim' | 'athletic' | 'muscular' | 'stocky' | 'petite' |
//             'curvy'), height (~0.95..1.08), top ('tee' | 'tank' |
//             'longsleeve' | 'sweater' | 'quarterzip' | 'hoodie' | 'overshirt' |
//             'blazer' | 'blouse' | 'dress'), bottom ('jeans' | 'pants' |
//             'shorts' | 'joggers' | 'dress'), shoes ('sneakers' | 'boots' |
//             'heels' | 'flats' | 'barefoot'), extras (['watch', 'chain',
//             'necklace', 'socks']), hairLen (long hair down the back)
//   colors    shirt / shirt2 (inner layer or trim) / pants / shoes / socks
//   stats     small tweaks: speed (x), jump (x), reach (+px). Keep it fair!
//   special   { type, name, description }
//   bio       one-liner for the select screen
//   quote     win quote
// ---------------------------------------------------------------------------

export const CHARACTERS = [
  {
    id: 'yotam', name: 'Yotam',
    face: { x: 0.47, y: 0.2, h: 0.32 },
    look: { skin: '#d9a585', hair: 'short', hairColor: '#1c1410', eyes: '#3a2416', brows: 2, beard: 'stubble', beardColor: '#2a1f1a', jaw: 0.94 },
    body: { build: 'athletic', height: 1.02, top: 'overshirt', bottom: 'jeans', shoes: 'sneakers' },
    colors: { shirt: '#4a2e22', shirt2: '#f2f2f2', pants: '#2a3550', shoes: '#ececec' },
    stats: { speed: 1.00, jump: 1.00, reach: 1 },
    special: { type: 'laserEyes', name: 'Laser Eyes', description: 'Had laser eye surgery. Now those eyes shoot actual lasers.' },
    bio: 'Sees everything. In 4K.',
    quote: '20/20 vision. 0/20 mercy.',
  },
  {
    id: 'gal', name: 'Gal',
    face: { x: 0.5, y: 0.19, h: 0.31 },
    look: { skin: '#f0c8a8', hair: 'longWavy', hairColor: '#6b4630', hairColor2: '#8e6444', eyes: '#4a3020', brows: 1, mouth: 'smile', female: true, lips: '#c87a74', earring: 'right', earringColor: '#d8d8e0', jaw: 0.92 },
    body: { build: 'petite', height: 0.95, top: 'blouse', bottom: 'jeans', shoes: 'flats', extras: ['necklace'], hairLen: 26 },
    colors: { shirt: '#f4f0ea', shirt2: '#e0d8cc', pants: '#7f9cc4', shoes: '#c9a27a' },
    stats: { speed: 1.05, jump: 1.04, reach: -1 },
    special: { type: 'babyRattle', name: 'Baby Bonk', description: 'The youngest of the gang. Turns into a baby and bonks you with a rattle.' },
    bio: 'Youngest. Fastest growing.',
    quote: 'Nap time for you!',
  },
  {
    id: 'ofir', name: 'Ofir',
    face: { x: 0.525, y: 0.146, h: 0.25 },
    look: { skin: '#d29a74', hair: 'curly', hairColor: '#2a1c14', eyes: '#6a7a50', brows: 2, beard: 'full', beardColor: '#2e2018', jaw: 1.05 },
    body: { build: 'muscular', height: 1.0, top: 'tee', bottom: 'jeans', shoes: 'boots', extras: ['watch', 'chain'] },
    colors: { shirt: '#26262c', shirt2: '#3a3a44', pants: '#4a6a9a', shoes: '#6a4024' },
    stats: { speed: 0.97, jump: 0.98, reach: 1 },
    special: { type: 'caneWhack', name: 'Back In My Day', description: 'The oldest of the gang. Ages 50 years in a second and whacks you with a cane.' },
    bio: 'Oldest. Wisest. Crankiest.',
    quote: 'Respect your elders!',
  },
  {
    id: 'ofek', name: 'Ofek',
    face: { x: 0.512, y: 0.185, h: 0.35 },
    look: { skin: '#f0c4a4', hair: 'fade', hairColor: '#3a2618', eyes: '#5a7080', brows: 2, beard: 'short', beardColor: '#5a3a24' },
    body: { build: 'athletic', height: 1.0, top: 'tee', bottom: 'pants', shoes: 'sneakers' },
    colors: { shirt: '#f0f0f0', shirt2: '#d71920', pants: '#1c1c24', shoes: '#d71920' },
    stats: { speed: 1.00, jump: 1.00, reach: 1 },
    special: { type: 'trophyBoomerang', name: "Captain's Cup", description: 'The captain. Suits up in red and throws the trophy like a boomerang.' },
    bio: 'Born to lift trophies.',
    quote: "Captain's orders!",
  },
  {
    id: 'ayoub', name: 'Ayoub',
    face: { x: 0.54, y: 0.225, h: 0.3 },
    look: { skin: '#e3b393', hair: 'quiff', hairColor: '#1a1210', eyes: '#3a2416', brows: 2, beard: 'full', beardColor: '#1e1612', glasses: '#1a1a24', jaw: 1.1 },
    body: { build: 'stocky', height: 0.97, top: 'quarterzip', bottom: 'pants', shoes: 'sneakers' },
    colors: { shirt: '#d9bfa0', shirt2: '#1a1a1a', pants: '#4a4a54', shoes: '#1a1a1a' },
    stats: { speed: 0.98, jump: 1.00, reach: 0 },
    special: { type: 'magicBolt', name: 'Abracadabra', description: 'Harry Potter superfan. A flick of the wand sends a sparkly magic bolt.' },
    bio: 'Still waiting for the owl.',
    quote: 'Ten points to my house!',
  },
  {
    id: 'eshel', name: 'Eshel',
    face: { x: 0.5, y: 0.2, h: 0.31 },
    look: { skin: '#e8b898', hair: 'quiff', hairColor: '#1e1612', eyes: '#4a3020', brows: 2, beard: 'stubble', beardColor: '#3a2a20', earring: 'right', earringColor: '#d8d8e0' },
    body: { build: 'athletic', height: 1.0, top: 'sweater', bottom: 'jeans', shoes: 'sneakers' },
    colors: { shirt: '#1c2440', shirt2: '#2c3a60', pants: '#2a3040', shoes: '#f0f0f0' },
    stats: { speed: 1.02, jump: 1.00, reach: 0 },
    special: { type: 'handFlurry', name: 'Talk To The Hands', description: 'Talks with the hands. A LOT. A hundred-hand slap of pure gesturing.' },
    bio: 'Every sentence is a dance.',
    quote: 'As I was saying...',
  },
  {
    id: 'ben', name: 'Ben',
    face: { x: 0.497, y: 0.235, h: 0.35 },
    look: { skin: '#f0c6a6', hair: 'wavy', hairColor: '#4a2e1c', eyes: '#5a4a2a', brows: 2, beard: 'short', beardColor: '#6a3e22', earring: 'left', earringColor: '#d8d8e0', jaw: 0.96 },
    body: { build: 'slim', height: 1.03, top: 'tank', bottom: 'shorts', shoes: 'sneakers', extras: ['socks', 'watch'] },
    colors: { shirt: '#ff7a1a', shirt2: '#ffffff', pants: '#22222a', shoes: '#3ec1ff', socks: '#ffffff' },
    stats: { speed: 1.05, jump: 1.02, reach: -1 },
    special: { type: 'sprintDash', name: 'Sprint Finish', description: 'The runner. Crosses the whole screen in a blink and bulldozes you.' },
    bio: 'Warms up with a marathon.',
    quote: 'Personal best!',
  },
  {
    id: 'dvir', name: 'Dvir',
    face: { x: 0.49, y: 0.24, h: 0.36 },
    look: { skin: '#e2b496', hair: 'fade', hairColor: '#1e1612', eyes: '#3a2a1e', brows: 2, beard: 'short', beardColor: '#2a1d16', mouth: 'smile', jaw: 1.0 },
    body: { build: 'muscular', height: 1.02, top: 'hoodie', bottom: 'joggers', shoes: 'sneakers' },
    colors: { shirt: '#1c1c22', shirt2: '#d8d8e0', pants: '#2a2a32', shoes: '#f0f0f0' },
    stats: { speed: 1.00, jump: 1.04, reach: 0 },
    special: { type: 'surfWave', name: 'Cowabunga', description: 'The surfer. Rides a giant wave straight through you.' },
    bio: 'Checks the waves before the weather.',
    quote: 'Totally tubular, bro.',
  },
  {
    id: 'hadar', name: 'Hadar',
    face: { x: 0.605, y: 0.16, h: 0.2 },
    look: { skin: '#f2cdb4', hair: 'longStraight', hairColor: '#2a1a14', eyes: '#3a2416', brows: 1, female: true, lips: '#c06a6a', jaw: 0.98 },
    body: { build: 'petite', height: 1.0, top: 'dress', bottom: 'dress', shoes: 'flats', hairLen: 22 },
    colors: { shirt: '#4a4a52', shirt2: '#5a5a64', pants: '#4a4a52', shoes: '#14101e' },
    stats: { speed: 1.02, jump: 1.00, reach: 0 },
    special: { type: 'tequilaToss', name: 'Tequila Time', description: 'Loves Mexico. Sombrero on, poncho on, tequila bottle incoming.' },
    bio: 'Half Israeli, half mariachi.',
    quote: 'Salud! Another round?',
  },
  {
    id: 'yair', name: 'Yair',
    face: { x: 0.52, y: 0.21, h: 0.35 },
    look: { skin: '#f2c8ac', hair: 'messy', hairColor: '#6a4a30', eyes: '#5a7a8a', brows: 1, beard: 'stubble', beardColor: '#8a6040' },
    body: { build: 'athletic', height: 0.99, top: 'quarterzip', bottom: 'jeans', shoes: 'sneakers' },
    colors: { shirt: '#9aa3ad', shirt2: '#d0d6dd', pants: '#2b3a5c', shoes: '#f0f0f0' },
    stats: { speed: 0.98, jump: 1.00, reach: 1 },
    special: { type: 'acBlast', name: 'Arctic AC', description: 'Keeps the AC on 16 degrees. Summons a giant AC: icy blast, then SLAM.' },
    bio: 'Brings a jacket to the beach.',
    quote: 'Stay cool.',
  },
  {
    id: 'yovel', name: 'Yovel',
    face: { x: 0.476, y: 0.18, h: 0.29 },
    look: { skin: '#efc0a0', hair: 'sidepart', hairColor: '#1e1612', eyes: '#3a2416', brows: 2, beard: 'short', beardColor: '#2a1e18' },
    body: { build: 'muscular', height: 1.0, top: 'tee', bottom: 'shorts', shoes: 'boots', extras: ['watch'] },
    colors: { shirt: '#f4f4f0', shirt2: '#dcdcd4', pants: '#a89060', shoes: '#5a4028' },
    stats: { speed: 1.00, jump: 1.02, reach: 0 },
    special: { type: 'bugSwarm', name: 'Bug Party', description: 'Loves bugs. Releases a swarm of ants and beetles. Block LOW!' },
    bio: 'Has named every ant in the yard.',
    quote: 'The bugs say hi.',
  },
  {
    id: 'yaara', name: 'Yaara',
    face: { x: 0.506, y: 0.178, h: 0.32 },
    look: { skin: '#f4d2bc', hair: 'longStraight', hairColor: '#120e10', eyes: '#2a1a14', brows: 1, female: true, lips: '#c0606a', jaw: 1.03 },
    body: { build: 'curvy', height: 0.97, top: 'longsleeve', bottom: 'jeans', shoes: 'sneakers', hairLen: 30 },
    colors: { shirt: '#e84a7f', shirt2: '#ffd0e0', pants: '#3a5070', shoes: '#ffffff' },
    stats: { speed: 1.04, jump: 0.98, reach: 0 },
    special: { type: 'bearHug', name: 'Bear Hug', description: 'Loves hugs. Runs in for a squeeze you cannot block (but can jump).' },
    bio: 'No personal space. Only love.',
    quote: 'Group hug next time!',
  },
  {
    id: 'maya', name: 'Maya',
    face: { x: 0.5, y: 0.225, h: 0.32 },
    look: { skin: '#e8b894', hair: 'longStraight', hairColor: '#4a2e1c', hairColor2: '#9a7450', eyes: '#3a2416', brows: 1, female: true, lips: '#c87070', jaw: 0.95 },
    body: { build: 'petite', height: 0.98, top: 'longsleeve', bottom: 'jeans', shoes: 'sneakers', hairLen: 28 },
    colors: { shirt: '#5fd3b3', shirt2: '#ffffff', pants: '#1c1c24', shoes: '#ff8cc6' },
    stats: { speed: 1.00, jump: 1.00, reach: 0 },
    special: { type: 'dessertBarrage', name: 'Sugar Rush', description: 'Dessert queen. A barrage of cakes, ice cream and cupcakes.' },
    bio: 'Bakes faster than you can eat.',
    quote: 'Sweet victory!',
  },
  {
    id: 'mor', name: 'Mor',
    face: { x: 0.5, y: 0.205, h: 0.32 },
    look: { skin: '#dba582', hair: 'messy', hairColor: '#1a1210', eyes: '#3a2416', brows: 2, beard: 'short', beardColor: '#1e1612', jaw: 1.02 },
    body: { build: 'athletic', height: 0.98, top: 'tee', bottom: 'shorts', shoes: 'sneakers', extras: ['socks'] },
    colors: { shirt: '#3d3d46', shirt2: '#ff69c8', pants: '#22222a', shoes: '#ffffff', socks: '#ff69c8' },
    stats: { speed: 1.04, jump: 1.03, reach: 0 },
    special: { type: 'spineChoke', name: 'Spine Out', description: 'Rips out his own spine and chokes you with it. Cannot be blocked (but can be jumped).' },
    bio: 'Has a backbone. Briefly.',
    quote: 'Nothing personal. Just spine.',
  },
  {
    id: 'nadav', name: 'Nadav',
    face: { x: 0.495, y: 0.222, h: 0.32 },
    look: { skin: '#f0c8aa', hair: 'sidepart', hairColor: '#3a2618', eyes: '#5a8aaa', brows: 1, beard: 'stubble', beardColor: '#5a3a24', jaw: 0.92 },
    body: { build: 'slim', height: 1.05, top: 'sweater', bottom: 'jeans', shoes: 'sneakers' },
    colors: { shirt: '#f2ead8', shirt2: '#e8b923', pants: '#2b3a5c', shoes: '#e8b923' },
    stats: { speed: 1.00, jump: 1.00, reach: 0 },
    special: { type: 'jackpotRain', name: 'Jackpot', description: 'Always wins polls and lotteries. Luck literally rains on you.' },
    bio: 'Won this spot in a raffle.',
    quote: 'Lucky? I call it skill.',
  },
  {
    id: 'noa', name: 'Noa',
    face: { x: 0.512, y: 0.226, h: 0.36 },
    look: { skin: '#f0c6aa', hair: 'longWavy', hairColor: '#24160f', eyes: '#3a2416', brows: 1, female: true, lips: '#c04a5a' },
    body: { build: 'petite', height: 0.97, top: 'blazer', bottom: 'pants', shoes: 'heels', hairLen: 24 },
    colors: { shirt: '#22222a', shirt2: '#ffffff', pants: '#22222a', shoes: '#c01830' },
    stats: { speed: 1.02, jump: 1.00, reach: 1 },
    special: { type: 'baguette', name: 'Oui Oui', description: 'Is French. Two baguette swings, then the baguette flies. Oui oui!' },
    bio: 'Croissant for breakfast. And lunch.',
    quote: "C'est la vie!",
  },
  {
    id: 'ido', name: 'Ido',
    face: { x: 0.506, y: 0.195, h: 0.32 },
    look: { skin: '#d8a080', hair: 'fade', hairColor: '#120e0c', eyes: '#3a2416', brows: 2, beard: 'short', beardColor: '#1a1210', jaw: 1.06 },
    body: { build: 'muscular', height: 1.08, top: 'tee', bottom: 'jeans', shoes: 'sneakers' },
    colors: { shirt: '#c8b090', shirt2: '#a89070', pants: '#2b2b33', shoes: '#1a1a1a' },
    stats: { speed: 0.96, jump: 0.97, reach: 1 },
    special: { type: 'giantStomp', name: 'Giant Stomp', description: 'Big and strong. Grows into a giant and stomps you flat.' },
    bio: 'Gym is a lifestyle.',
    quote: "Sorry, didn't see you down there.",
  },
  {
    id: 'shay', name: 'Shay',
    face: { x: 0.503, y: 0.205, h: 0.32 },
    look: { skin: '#f2caa8', hair: 'longCurly', hairColor: '#6a4a2a', hairColor2: '#d8b878', eyes: '#5a6a6a', brows: 1, female: true, lips: '#c87878' },
    body: { build: 'curvy', height: 0.98, top: 'tee', bottom: 'pants', shoes: 'sneakers', extras: ['necklace'], hairLen: 24, hairStyle: 'curly' },
    colors: { shirt: '#f4f0e8', shirt2: '#e0dccf', pants: '#1c1c24', shoes: '#ffffff' },
    stats: { speed: 1.00, jump: 1.00, reach: 0 },
    special: { type: 'soundBlast', name: 'Mic Drop', description: 'Loves singing. Giant speakers plus sound waves equals you, far away.' },
    bio: 'Sings in the shower. And everywhere.',
    quote: 'Thank you, goodnight!',
  },
  {
    id: 'nethanel', name: 'Nethanel', isNew: true,
    face: { x: 0.5, y: 0.2, h: 0.3 },
    look: { skin: '#e0a47c', hair: 'short', hairColor: '#3a2a20', eyes: '#3a2416', brows: 2, beard: 'short', beardColor: '#3a2a20', jaw: 1.0 },
    body: { build: 'muscular', height: 1.02, top: 'tee', bottom: 'pants', shoes: 'boots' },
    colors: { shirt: '#1c2440', shirt2: '#4a4a4a', pants: '#56683a', shoes: '#1a1a1a' },
    stats: { speed: 0.99, jump: 1.00, reach: 1 },
    special: { type: 'kaderLecture', name: 'Lekader', description: 'Makes you give a lecture in the guild. Forced to Lekader, slide after slide. Cannot be blocked (but can be jumped).' },
    bio: 'Born to Lekader. Never stops Kadering.',
    quote: 'Thank you for coming to my Kader!',
  },
  {
    id: 'rashida', name: 'Rashida', isNew: true,
    face: { x: 0.5, y: 0.2, h: 0.3 },
    look: { skin: '#d49a72', hair: 'longWavy', hairColor: '#14100e', eyes: '#3a2416', brows: 1, mouth: 'smile', female: true, lips: '#b8604c', glasses: '#e8b923', earring: 'right', earringColor: '#e8b923', jaw: 0.94 },
    body: { build: 'athletic', height: 1.0, top: 'overshirt', bottom: 'pants', shoes: 'boots', hairLen: 24 },
    colors: { shirt: '#2a4a8a', shirt2: '#2a2a30', pants: '#5a5a62', shoes: '#1a1a1a' },
    stats: { speed: 1.01, jump: 1.00, reach: 0 },
    special: { type: 'lateSwag', name: "You're Late!", description: "Yells that you're late, then pelts you with swag and merch: shirts, caps, mugs and tote bags." },
    bio: 'Has the merch. And the attitude.',
    quote: 'Next time, be on time. Here, take a hoodie.',
  },
];

export const byId = (id) => CHARACTERS.find((c) => c.id === id);
