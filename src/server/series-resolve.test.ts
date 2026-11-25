import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTargetSeries } from './series-resolve.js';
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
