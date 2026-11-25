import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest } from './crz-format.js';

const minimalV2 = {
  formatVersion: 2,
  exportedAt: '2026-01-01T00:00:00.000Z',
  originSeriesId: 'some-series',
  partIndex: 0,
  totalParts: 1,
  type: 'comic',
  title: 'Some Series',
  tags: [],
  placeholder: 'manga.png',
  nsfw: false,
  coverFile: null,
  chapters: [{ file: 'chapters/001.pdf', chapter: '1', order: 1, pages: 10 }],
  hasTranslations: false,
};

test('v2 manifest accepts type "book"', () => {
  const r = validateManifest({ ...minimalV2, type: 'book' });
  assert.equal(r.ok, true, JSON.stringify(r));
});

test('v2 manifest still rejects unknown type', () => {
  const r = validateManifest({ ...minimalV2, type: 'novel' });
  assert.equal(r.ok, false);
});
