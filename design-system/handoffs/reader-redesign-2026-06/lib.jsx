/* Bindery UI kit — shared helpers, fake data, and chrome.
   Exposes everything on window for the other Babel scripts. */

const DS = window.BinderyDesignSystem_cd2bc2;

/* ---- Lucide icon helper ----
   Renders the SVG via innerHTML (NOT createIcons) so Lucide never replaces a
   React-owned node — that swap makes React's later removeChild throw on unmount
   and blanks the whole app. innerHTML content is opaque to React, so it's safe. */
function kebabToPascal(name) {
  return name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}
function Ic({ name, size = 18, style }) {
  const html = React.useMemo(() => {
    const L = window.lucide;
    if (!L) return '';
    const node = (L.icons && L.icons[kebabToPascal(name)]) || L[kebabToPascal(name)];
    if (!node || !L.createElement) return '';
    const el = L.createElement(node);
    el.setAttribute('width', size);
    el.setAttribute('height', size);
    return el.outerHTML;
  }, [name, size]);
  return <span style={{ display: 'inline-flex', width: size, height: size, ...style }} dangerouslySetInnerHTML={{ __html: html }} />;
}

/* ---- Asset paths ---- */
const ART = {
  fox: '../../assets/logo.png',
  forest: '../../assets/login-bg/login-bg-1.jpg',
  bg2: '../../assets/login-bg/login-bg-2.jpg',
  bg3: '../../assets/login-bg/login-bg-3.jpg',
  manga: '../../assets/placeholders/manga.png',
  discover: '../../assets/placeholders/discover-online.png',
  import: '../../assets/placeholders/import-first.png',
  // Real manga / manhwa covers (user-supplied)
  cFairy:    '../../assets/covers/fairy-tail.jpg',
  cDnd:      '../../assets/covers/dnd.jpg',
  cDungeon:  '../../assets/covers/dungeon-levelup.jpg',
  cChainsaw: '../../assets/covers/chainsaw-man.jpg',
  cGluttony: '../../assets/covers/berserk-gluttony.jpg',
  cArifureta:'../../assets/covers/arifureta.jpg',
  cRepair:   '../../assets/covers/repair-skill.jpg',
  cLevel1:   '../../assets/covers/level-1-player.jpg',
  cWise:     '../../assets/covers/wise-man.jpg',
  cPaladin:  '../../assets/covers/paladin.jpg',
  cRomcom:   '../../assets/covers/skill-romcom.jpg',
  cAtm:      '../../assets/covers/atm-ojisan.jpg',
};
// Discover stand-in covers, cycled from the real cover art.
const COVERS = [];

/* ---- Fake library — real titles matched to their cover art ---- */
const SERIES = [
  { id: 's1', name: 'Fairy Tail', en: null, year: 2006, ch: 12, read: 5, score: 7.6, status: 'ongoing', cover: ART.cFairy, neww: 3, pinned: true, tags: ['fantasy','adventure','shounen'],
    synopsis: 'A celestial-spirit mage and a fire-breathing dragon slayer take jobs for the rowdiest guild in Fiore \u2014 and find a family in the chaos.' },
  { id: 's2', name: 'Dungeons & Dragons', en: 'Library Collection', year: 2021, ch: 10, read: 10, score: 8.0, status: 'completed', cover: ART.cDnd, saved: true, tags: ['fantasy','adventure'],
    synopsis: 'A drow ranger and his companions are hunted through the Underdark in this collected run of the tabletop world\u2019s comics.' },
  { id: 's3', name: 'Level-Up Alone', en: 'Dungeon Monopoly', year: 2022, ch: 8, read: 2, score: 8.4, status: 'ongoing', cover: ART.cDungeon, neww: 2, tags: ['action','fantasy','manhwa'],
    synopsis: 'A weak hunter discovers a dungeon only he can enter \u2014 and starts climbing it one quiet, ruthless level at a time.' },
  { id: 's4', name: 'Chainsaw Man', en: null, year: 2018, ch: 16, read: 9, score: 8.6, status: 'ongoing', cover: ART.cChainsaw, neww: 0, tags: ['action','horror','seinen'],
    synopsis: 'A broke devil-hunter merges with his chainsaw dog and is drafted into a government squad that kills devils for a living.' },
  { id: 's5', name: 'Berserk of Gluttony', en: null, year: 2017, ch: 11, read: 3, score: 7.8, status: 'ongoing', cover: ART.cGluttony, neww: 1, tags: ['fantasy','action'],
    synopsis: 'A guardsman with a useless, ever-hungry skill learns it can devour the strength of anything he kills.' },
  { id: 's6', name: 'Arifureta', en: 'From Commonplace to Strongest', year: 2018, ch: 14, read: 8, score: 7.5, status: 'ongoing', cover: ART.cArifureta, neww: 0, tags: ['isekai','fantasy','harem'],
    synopsis: 'Betrayed and left for dead in a labyrinth, an ordinary classmate claws his way back up as something monstrous.' },
  { id: 's7', name: 'My Repair Skill', en: 'Became a Versatile Cheat', year: 2021, ch: 9, read: 0, score: 7.2, status: 'ongoing', cover: ART.cRepair, tags: ['isekai','fantasy','comedy'],
    synopsis: 'Summoned with a skill everyone calls worthless, a young man opens a weapon shop \u2014 and quietly breaks the rules of repair.' },
  { id: 's8', name: 'Level 1 Player', en: null, year: 2023, ch: 12, read: 4, score: 8.1, status: 'ongoing', cover: ART.cLevel1, neww: 4, tags: ['action','manhwa'],
    synopsis: 'Stuck at level one while the world levels past him, one player finds the single exploit the system never patched.' },
  { id: 's9', name: 'Reincarnated as a Sage', en: 'Adventurer Life', year: 2018, ch: 8, read: 8, score: 7.4, status: 'completed', cover: ART.cWise, saved: true, tags: ['isekai','fantasy'],
    synopsis: 'Reborn into a world of magic, a salaryman rebuilds spellcraft from first principles and lives the adventurer life he always wanted.' },
  { id: 's10', name: 'The Faraway Paladin', en: null, year: 2017, ch: 20, read: 14, score: 8.3, status: 'hiatus', cover: ART.cPaladin, tags: ['fantasy','adventure'],
    synopsis: 'Raised in a city of the dead by three undead guardians, a boy sets out to learn what it means to be alive.' },
  { id: 's11', name: 'Flirting in Another World', en: 'With My Given Skill', year: 2022, ch: 6, read: 0, score: 6.9, status: 'ongoing', cover: ART.cRomcom, tags: ['romance','ecchi','nsfw'],
    synopsis: 'A gifted appraiser would rather spend his cheat skill charming the beauties of the new world than saving it.' },
  { id: 's12', name: 'ATM Ojisan', en: null, year: 2020, ch: 13, read: 6, score: 7.0, status: 'completed', cover: ART.cAtm, tags: ['comedy','isekai'],
    synopsis: 'An ordinary office worker is reborn into a fantasy world where, inexplicably, he is everyone\u2019s favorite walking treasury.' },
];

// Discover stand-ins reuse the library's real cover art.
SERIES.forEach((s) => COVERS.push(s.cover));

// Augment with subscription / offline / recommend state for the Series page.
SERIES.forEach((s, i) => {
  s.savedOffline = !!s.saved;                 // explicitly saved-for-offline
  s.source = s.status === 'ongoing' ? ['MangaDex', 'MangaFox', 'Rawkuma'][i % 3] : null;
  s.lastSync = s.status === 'ongoing' ? ['2h ago', 'yesterday', '3d ago'][i % 3] : null;
});
SERIES[0].favoritedBy = ['Kira', 'Mio'];      // Fairy Tail — recommended by household
SERIES[3].favoritedBy = ['Kira'];             // Chainsaw Man
SERIES[7].favoritedBy = ['Mio', 'Ren', 'Kira']; // Level 1 Player
SERIES[4].partialLast = true;                 // Berserk of Gluttony — last chapter partial

/* Chapter list with the full range of per-chapter states:
   read · in-progress · unread · new · downloaded (offline) · partial. */
function chapters(s) {
  const out = [];
  for (let i = 0; i < s.ch; i++) {
    const n = i + 1;
    const pages = 18 + ((n * 7) % 14);
    const isRead = i < s.read;
    const inProg = i === s.read && s.read > 0 && s.read < s.ch;
    const isNew = s.neww > 0 && i >= s.ch - s.neww;          // last `neww` are freshly synced
    const downloaded = isRead || inProg;                      // cached what you've opened
    const partial = (s.partialLast && i === s.ch - 1)
      ? { ok: pages - 5, total: pages, retry: 2 } : null;
    const page = inProg ? Math.floor(pages * 0.4) : 0;
    out.push({
      n, file: `Chapter ${n}`, pages,
      read: isRead, inProg, isNew, downloaded, partial,
      page, progress: inProg ? 40 : 0,
    });
  }
  return out;
}

const CONTINUE = [
  { s: SERIES[0], ch: 6, page: 9, pages: 24 },
  { s: SERIES[5], ch: 10, page: 14, pages: 31 },
  { s: SERIES[2], ch: 3, page: 5, pages: 20 },
  { s: SERIES[9], ch: 15, page: 22, pages: 28 },
];

/* ---- Admin fake data ---- */
const ADMIN_STATS = { version: '4.2.0', seriesCount: 12, chapterCount: 148, librarySize: 6_180_000_000, dataSize: 214_000_000 };

const TASKS = [
  { id: 't1', title: 'Chainsaw Man', status: 'downloading', cur: 7, total: 16, chapter: '7' },
  { id: 't2', title: 'Level 1 Player', status: 'downloading', cur: 3, total: 12, chapter: '3' },
  { id: 't3', title: 'Berserk of Gluttony', status: 'queued', cur: 0, total: 11, chapter: null },
  { id: 't4', title: 'The Faraway Paladin', status: 'queued', cur: 0, total: 20, chapter: null },
  { id: 't5', title: 'Fairy Tail', status: 'complete', cur: 12, total: 12, chapter: null },
  { id: 't6', title: 'ATM Ojisan', status: 'error', cur: 4, total: 13, chapter: null, error: 'Source blocked by Cloudflare — try the manga-finder extension' },
];

const SUBSCRIPTIONS = SERIES.filter(s => s.source).map(s => ({
  id: s.id, name: s.name, en: s.en, source: s.source,
  mangaId: s.id.replace('s', '') + '-' + s.name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 8),
  chapterCount: s.ch, newChapterCount: s.neww || 0, lastSync: s.lastSync,
}));

const USERS = [
  { username: 'Jammo', admin: true, collection: 12, read: 64, tracked: 4 },
  { username: 'Kira', admin: false, collection: 8, read: 41, tracked: 3 },
  { username: 'Mio', admin: false, collection: 15, read: 92, tracked: 6 },
  { username: 'Ren', admin: false, collection: 3, read: 7, tracked: 1 },
];

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}

Object.assign(window, { DS, Ic, ART, COVERS, SERIES, CONTINUE, chapters, ADMIN_STATS, TASKS, SUBSCRIPTIONS, USERS, formatBytes });
