import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTargetSeries, resolveJobTarget, findActiveJobForSeries, sameEnqueueTarget, type ActiveJobLike } from './series-resolve.js';
import type { SeriesRecord, SeriesType } from './data.js';

function mk(id: string, type: SeriesType, extra: Partial<SeriesRecord> = {}): SeriesRecord {
  return {
    id,
    type,
    name: id,
    coverFile: null,
    score: null,
    synopsis: null,
    tags: [],
    status: null,
    year: null,
    malId: null,
    mangaDexId: null,
    englishTitle: null,
    placeholder: '',
    ...extra,
  };
}

test('syncSource match wins over type', () => {
  const moved = mk('dcc', 'book', { syncSource: { sourceId: 'mangadex', mangaId: 'm1' }, name: 'Dungeon Crawler Carl' });
  const r = resolveTargetSeries([moved], { title: 'Dungeon Crawler Carl', sourceId: 'mangadex', mangaId: 'm1', type: 'comic' });
  assert.equal(r.existing?.id, 'dcc');
  assert.equal(r.id, 'dcc');
});

test('same title, other type → new id with type suffix', () => {
  const manga = mk('dungeon-crawler-carl', 'comic', { name: 'Dungeon Crawler Carl' });
  const r = resolveTargetSeries([manga], { title: 'Dungeon Crawler Carl', sourceId: 'archiveorg-books', mangaId: 'series:dcc', type: 'book' });
  assert.equal(r.existing, null);
  assert.equal(r.id, 'dungeon-crawler-carl-book');
});

test('same title, same type → merges into existing', () => {
  const manga = mk('dungeon-crawler-carl', 'comic', { name: 'Dungeon Crawler Carl' });
  const r = resolveTargetSeries([manga], { title: 'Dungeon Crawler Carl', sourceId: 'mangadex', mangaId: 'other', type: 'comic' });
  assert.equal(r.existing?.id, 'dungeon-crawler-carl');
  assert.equal(r.id, 'dungeon-crawler-carl');
});

test('slug match within type merges even when the name differs', () => {
  const s = mk('one-piece', 'comic', { name: 'ONE PIECE (Official)' });
  const r = resolveTargetSeries([s], { title: 'One Piece', sourceId: 's', type: 'comic' });
  assert.equal(r.existing?.id, 'one-piece');
});

test('collision suffix increments', () => {
  const all = [mk('x', 'comic', { name: 'X' }), mk('x-book', 'magazine', { name: 'X other' })];
  const r = resolveTargetSeries(all, { title: 'X', sourceId: 's', type: 'book' });
  assert.equal(r.existing, null);
  assert.equal(r.id, 'x-book-2');
});

test('collision suffix keeps counting past taken numbered ids', () => {
  const all = [mk('x', 'comic'), mk('x-book', 'magazine'), mk('x-book-2', 'comic')];
  const r = resolveTargetSeries(all, { title: 'X', sourceId: 's', type: 'book' });
  assert.equal(r.id, 'x-book-3');
});

test('free slug is used as-is', () => {
  const r = resolveTargetSeries([mk('other', 'comic')], { title: 'Brand New', sourceId: 's', type: 'book' });
  assert.equal(r.existing, null);
  assert.equal(r.id, 'brand-new');
});

test('english title matches within type only', () => {
  const mag = mk('mag-1', 'magazine', { name: 'Shuukan', englishTitle: 'Weekly Jump' });
  const other = resolveTargetSeries([mag], { title: 'weekly jump', sourceId: 's', type: 'comic' });
  assert.equal(other.existing, null);
  assert.equal(other.id, 'weekly-jump');
  const same = resolveTargetSeries([mag], { title: 'weekly jump', sourceId: 's', type: 'magazine' });
  assert.equal(same.existing?.id, 'mag-1');
});

test('no mangaId skips the syncSource rule', () => {
  const subscribed = mk('sub', 'comic', { name: 'Sub', syncSource: { sourceId: 's', mangaId: '' } });
  const titled = mk('title-match', 'book', { name: 'Title Match' });
  const r = resolveTargetSeries([subscribed, titled], { title: 'Title Match', sourceId: 's', type: 'book' });
  assert.equal(r.existing?.id, 'title-match');
  const nullId = resolveTargetSeries([subscribed, titled], { title: 'Title Match', sourceId: 's', mangaId: null, type: 'book' });
  assert.equal(nullId.existing?.id, 'title-match');
});

test("empty-string mangaId does not match a syncSource with an empty mangaId", () => {
  const subscribed = mk("sub", "comic", { name: "Sub", syncSource: { sourceId: "s", mangaId: "" } });
  const titled = mk("title-match", "comic", { name: "Title Match" });
  const r = resolveTargetSeries([subscribed, titled], { title: "Title Match", sourceId: "s", mangaId: "", type: "comic" });
  assert.equal(r.existing?.id, "title-match");
});

// --- resolveJobTarget: explicit target id beats title resolution ---

test('job with targetSeriesId of a book series lands there despite a comic-type source', () => {
  const book = mk('dungeon-crawler-carl', 'book', { name: 'Dungeon Crawler Carl' });
  const r = resolveJobTarget([book], {
    targetSeriesId: 'dungeon-crawler-carl',
    title: 'Dungeon Crawler Carl',
    sourceId: 'mangadex',
    mangaId: 'm1',
    type: 'comic',
  });
  assert.equal(r.existing?.id, 'dungeon-crawler-carl');
  assert.equal(r.id, 'dungeon-crawler-carl');
  assert.equal(r.type, 'book');
  assert.equal(r.fellBack, false);
});

test('targetSeriesId that no longer exists falls back to resolution and says so', () => {
  const manga = mk('dungeon-crawler-carl', 'comic', { name: 'Dungeon Crawler Carl' });
  const r = resolveJobTarget([manga], {
    targetSeriesId: 'gone',
    title: 'Dungeon Crawler Carl',
    sourceId: 'mangadex',
    mangaId: 'm1',
    type: 'comic',
  });
  assert.equal(r.existing?.id, 'dungeon-crawler-carl');
  assert.equal(r.id, 'dungeon-crawler-carl');
  assert.equal(r.type, 'comic');
  assert.equal(r.fellBack, true);
});

test('no targetSeriesId resolves normally without flagging a fallback', () => {
  const r = resolveJobTarget([mk('other', 'comic')], {
    title: 'Brand New',
    sourceId: 'archiveorg-books',
    mangaId: 'b1',
    type: 'book',
  });
  assert.equal(r.existing, null);
  assert.equal(r.id, 'brand-new');
  assert.equal(r.type, 'book');
  assert.equal(r.fellBack, false);
});

// --- findActiveJobForSeries: the PATCH type-move guard predicate ---

function job(extra: Partial<ActiveJobLike> & { mangaDexId: string }): ActiveJobLike {
  return { status: 'queued', mangaTitle: '', ...extra };
}

test('active job matching targetSeriesId blocks a type move', () => {
  const s = mk('dcc', 'book', { name: 'Dungeon Crawler Carl' });
  const active = job({ mangaDexId: 'm1', targetSeriesId: 'dcc', status: 'downloading' });
  assert.equal(findActiveJobForSeries([active], s), active);
});

test('complete and errored jobs never block a type move', () => {
  const s = mk('dcc', 'book');
  const done = job({ mangaDexId: 'm1', targetSeriesId: 'dcc', status: 'complete' });
  const failed = job({ mangaDexId: 'm1', targetSeriesId: 'dcc', status: 'error' });
  assert.equal(findActiveJobForSeries([done, failed], s), undefined);
});

test('legacy job without targetSeriesId matches via syncSource', () => {
  const s = mk('dcc', 'book', { syncSource: { sourceId: 'mangadex', mangaId: 'm1' } });
  const legacy = job({ mangaDexId: 'm1', metadata: { sourceId: 'mangadex' } });
  assert.equal(findActiveJobForSeries([legacy], s), legacy);
  const otherSource = job({ mangaDexId: 'm1', metadata: { sourceId: 'mangafox' } });
  assert.equal(findActiveJobForSeries([otherSource], s), undefined);
});

test('legacy job without targetSeriesId matches via title slug', () => {
  const s = mk('dungeon-crawler-carl', 'comic');
  const legacy = job({ mangaDexId: 'x', mangaTitle: 'Dungeon Crawler Carl' });
  assert.equal(findActiveJobForSeries([legacy], s), legacy);
});

test('a job for an unrelated series does not block', () => {
  const s = mk('dcc', 'book', { name: 'Dungeon Crawler Carl' });
  const other = job({ mangaDexId: 'z', targetSeriesId: 'other', mangaTitle: 'Other' });
  assert.equal(findActiveJobForSeries([other], s), undefined);
});

// --- sameEnqueueTarget: dedupe key for queueDownload ---

test('enqueue dedupe matches on targetSeriesId, source and user', () => {
  const existing = { targetSeriesId: 'dcc', mangaDexId: 'm1', username: 'james', sourceId: 'mangadex' };
  assert.equal(sameEnqueueTarget(existing, { targetSeriesId: 'dcc', mangaDexId: 'dcc', username: 'james', sourceId: 'mangadex' }), true);
  assert.equal(sameEnqueueTarget(existing, { targetSeriesId: 'dcc', mangaDexId: 'm1', username: 'other', sourceId: 'mangadex' }), false);
  assert.equal(sameEnqueueTarget(existing, { targetSeriesId: 'dcc', mangaDexId: 'm1', username: 'james', sourceId: 'mangafox' }), false);
});

test('enqueue dedupe falls back to mangaDexId when either side lacks a target id', () => {
  const legacy = { mangaDexId: 'm1', username: 'james', sourceId: 'mangadex' };
  assert.equal(sameEnqueueTarget(legacy, { targetSeriesId: 'dcc', mangaDexId: 'm1', username: 'james', sourceId: 'mangadex' }), true);
  assert.equal(sameEnqueueTarget(legacy, { mangaDexId: 'm2', username: 'james', sourceId: 'mangadex' }), false);
  assert.equal(sameEnqueueTarget({ targetSeriesId: 'a', mangaDexId: 'm1', username: 'james', sourceId: 's' }, { targetSeriesId: 'b', mangaDexId: 'm1', username: 'james', sourceId: 's' }), false);
});

test('legacy job without targetSeriesId matches via series name when the slug differs', () => {
  const s = mk('one-piece', 'comic', { name: 'ONE PIECE (Official)', englishTitle: 'One Piece Eng' });
  assert.equal(findActiveJobForSeries([job({ mangaDexId: 'x', mangaTitle: 'one piece (official)' })], s)?.mangaDexId, 'x');
  assert.equal(findActiveJobForSeries([job({ mangaDexId: 'y', mangaTitle: 'ONE PIECE ENG' })], s)?.mangaDexId, 'y');
});
