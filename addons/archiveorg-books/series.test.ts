import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBookTitle, normalizeKey, groupBySeries, orderMembers, creatorString } from './series.js';

test('parseBookTitle strips "Book N. Subtitle" and captures the number', () => {
  assert.deepEqual(parseBookTitle('Dungeon Crawler Carl. Book 7. This Inevitable Ruin'),
    { seriesTitle: 'Dungeon Crawler Carl', seriesKey: 'dungeon crawler carl', bookNumber: 7 });
  assert.equal(parseBookTitle('Dungeon Crawler Carl. Book 1.').bookNumber, 1);
  assert.equal(parseBookTitle('Dungeon Crawler Carl. Book 4. The Gate Of The Feral Gods.').seriesKey, 'dungeon crawler carl');
});

test('parseBookTitle ignores Part N inside a subtitle', () => {
  const p = parseBookTitle('Dungeon Crawler Carl: Part 1 of "Backstage At The Pineapple Cabaret"', 'Matt Dinniman');
  assert.equal(p.seriesKey, 'dungeon crawler carl');
  assert.equal(p.bookNumber, null);
});

test('parseBookTitle reads bracketed markers after a subtitle', () => {
  assert.deepEqual(parseBookTitle('Mistborn: The Final Empire (Book 1)'),
    { seriesTitle: 'Mistborn', seriesKey: 'mistborn', bookNumber: 1 });
});

test('parseBookTitle strips a trailing creator only when creator is known', () => {
  assert.equal(parseBookTitle('Dungeon Crawler Carl - Matt Dinniman', 'Matt Dinniman').seriesKey, 'dungeon crawler carl');
  assert.equal(parseBookTitle('Dungeon Crawler Carl Matt Dinniman', null).seriesKey, 'dungeon crawler carl matt dinniman');
  assert.equal(parseBookTitle('Pride and prejudice', ['Austen, Jane, 1775-1817', 'Thomson, Hugh']).seriesKey, 'pride and prejudice');
});

test('normalizeKey drops leading "the", punctuation and case, and is idempotent', () => {
  assert.equal(normalizeKey('The Hobbit!'), 'hobbit');
  assert.equal(normalizeKey(normalizeKey('  The  Wheel of Time. ')), 'wheel of time');
});

test('creatorString joins arrays and passes null through', () => {
  assert.equal(creatorString(['A', 'B']), 'A, B');
  assert.equal(creatorString('A'), 'A');
  assert.equal(creatorString(null), null);
});

const dcc = [
  { identifier: 'parade', title: 'A Parade Of Horribles Generic 2026 02 09', creator: 'Matt Diniman', date: '2026-05-12T00:00:00Z' },
  { identifier: 'untitled', title: 'Dungeon Crawler Carl Matt Dinniman', creator: null, date: null },
  { identifier: 'cabaret', title: 'Dungeon Crawler Carl: Part 1 of "Backstage At The Pineapple Cabaret"', creator: 'Matt Dinniman', date: '2025-12-01T00:00:00Z' },
  { identifier: 'b7', title: 'Dungeon Crawler Carl. Book 7. This Inevitable Ruin', creator: null, date: null },
  { identifier: 'b2', title: 'Dungeon Crawler Carl. Book 2. Doomsday Scenario.', creator: null, date: null },
  { identifier: 'b4b', title: 'Dungeon Crawler Carl. Book 4. The Gate Of The Feral Gods.', creator: null, date: null },
  { identifier: 'b4a', title: 'Dungeon Crawler Carl. Book 4. The Gate of the Feral Gods', creator: 'Matt Dinniman', date: '2020-10-02T00:00:00Z' },
  { identifier: 'b1', title: 'Dungeon Crawler Carl. Book 1.', creator: null, date: null },
];

test('groupBySeries puts the seven numbered books and the side story together', () => {
  const groups = groupBySeries(dcc);
  const main = groups.find((g) => g.seriesKey === 'dungeon crawler carl')!;
  assert.equal(main.seriesTitle, 'Dungeon Crawler Carl');
  assert.deepEqual(main.members.map((m) => m.identifier).sort(), ['b1', 'b2', 'b4a', 'b4b', 'b7', 'cabaret']);
  assert.ok(groups.some((g) => g.seriesKey.startsWith('a parade of horribles')));
  assert.ok(groups.some((g) => g.seriesKey === 'dungeon crawler carl matt dinniman'));
});

test('orderMembers numbers books by bookNumber then unnumbered by date after the max', () => {
  const main = groupBySeries(dcc).find((g) => g.seriesKey === 'dungeon crawler carl')!;
  const ordered = orderMembers(main.members);
  assert.deepEqual(ordered.map((m) => [m.identifier, m.chapter]),
    [['b1', 1], ['b2', 2], ['b4b', 4], ['b4a', 4], ['b7', 7], ['cabaret', 8]]);
  assert.equal(ordered.find((m) => m.identifier === 'cabaret')!.chapterTitle,
    'Dungeon Crawler Carl: Part 1 of "Backstage At The Pineapple Cabaret" (2025)');
  assert.equal(ordered.find((m) => m.identifier === 'b2')!.chapterTitle, 'Dungeon Crawler Carl. Book 2. Doomsday Scenario');
});

test('orderMembers gives editions of one unnumbered book distinct chapters, null dates last', () => {
  const eds = groupBySeries([
    { identifier: 'pp2', title: 'Pride and prejudice', creator: 'Austen, Jane', date: null },
    { identifier: 'pp1', title: 'Pride and prejudice', creator: 'Austen, Jane', date: '1894-01-01T00:00:00Z' },
    { identifier: 'pp3', title: 'Pride and prejudice : a novel', creator: 'Austen, Jane', date: '1833-01-01T00:00:00Z' },
  ])[0].members;
  assert.deepEqual(orderMembers(eds).map((m) => [m.identifier, m.chapter, m.chapterTitle]),
    [['pp3', 1, 'Pride and prejudice : a novel (1833)'], ['pp1', 2, 'Pride and prejudice (1894)'], ['pp2', 3, 'Pride and prejudice']]);
});
