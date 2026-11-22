import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupToResult, pickChapters } from './index.js';
import { groupBySeries } from './series.js';

test('groupToResult builds one search result from a series group', () => {
  const [group] = groupBySeries([
    { identifier: 'b2', title: 'Series. Book 2.', creator: null, date: '2021-01-01T00:00:00Z', description: '<p>Longer <b>second</b> blurb</p>', language: 'eng' },
    { identifier: 'b1', title: 'Series. Book 1.', creator: 'Someone', date: '2019-05-01T00:00:00Z', description: ['Short'], language: ['jpn'] },
  ]);
  const r = groupToResult(group);
  assert.equal(r.sourceId, 'archiveorg-books');
  assert.equal(r.mangaId, 'series:series');
  assert.equal(r.title, 'Series');
  assert.equal(r.coverUrl, 'https://archive.org/services/img/b2');
  assert.equal(r.description, 'Longer second blurb');
  assert.equal(r.year, 2019);
  assert.deepEqual([...r.tags].sort(), ['english', 'japanese']);
  assert.equal(r.status, 'completed');
});

test('pickChapters keeps numbering stable when a member has no file and keeps the best duplicate of a numbered book', () => {
  const f = (name: string, size = '1000000') => ({ name, size, format: '', source: 'original' });
  const docs = groupBySeries([
    { identifier: 'b4b', title: 'Series. Book 4.', creator: null, date: null },
    { identifier: 'b4a', title: 'Series. Book 4.', creator: null, date: '2020-01-01T00:00:00Z' },
    { identifier: 'b1', title: 'Series. Book 1.', creator: null, date: null },
    { identifier: 'e1', title: 'Series', creator: null, date: '1900-01-01T00:00:00Z' },
    { identifier: 'e2', title: 'Series', creator: null, date: '1950-01-01T00:00:00Z' },
    { identifier: 'e3', title: 'Series', creator: null, date: '1990-01-01T00:00:00Z' },
  ])[0].members;
  const file = new Map([
    ['b4b', f('b4b.epub')], ['b4a', f('b4a.pdf')], ['b1', f('b1.pdf')],
    ['e1', f('e1.pdf')], ['e3', f('e3.pdf')], // e2 has no downloadable file
  ]);
  const picked = pickChapters(docs.map((doc) => ({ doc, file: file.get(doc.identifier) ?? null })));
  assert.deepEqual(picked.map((p) => [p.identifier, p.chapter, p.file.name]),
    [['b1', 1, 'b1.pdf'], ['b4a', 4, 'b4a.pdf'], ['e1', 1000, 'e1.pdf'], ['e3', 1002, 'e3.pdf']]);
});
