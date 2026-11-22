import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractVolumeNumber, scoreFile, pickCanonicalFiles, bestFile, type ArchiveFile } from './files.js';

const f = (name: string, size = '1000000', source = 'original'): ArchiveFile => ({ name, size, format: '', source });

test('extractVolumeNumber reads volume, chapter and bare numbers', () => {
  assert.equal(extractVolumeNumber('No Game No Life Volume 01.pdf'), 1);
  assert.equal(extractVolumeNumber('Berserk v12 [Dark Horse].cbz'), 12);
  assert.equal(extractVolumeNumber('Akira Chapter 3.5.cbz'), 3.5);
  assert.equal(extractVolumeNumber('No Game No Life 01.pdf'), 1);
  assert.equal(extractVolumeNumber('_OceanofPDF.com_The_Gate_of_the_Feral_Gods_-_Matt_Dinniman.pdf'), null);
});

test('scoreFile prefers pdf > cbz > cbr > epub and rejects other formats', () => {
  const s = (n: string) => scoreFile(f(n));
  assert.ok(s('a.pdf') > s('a.cbz') && s('a.cbz') > s('a.cbr') && s('a.cbr') > s('a.epub'));
  assert.equal(s('a.mobi'), -1);
  assert.ok(s('a [Yen Press].pdf') > s('a.pdf'));
  assert.ok(s('a [Alternative Layout 2].pdf') < s('a.pdf'));
});

test('pickCanonicalFiles groups by volume and keeps the best file per volume', () => {
  const picks = pickCanonicalFiles([
    f('Series Vol 1.epub'), f('Series Vol 1.pdf'), f('Series Vol 2.cbz'), f('Series Vol 2 scan.jp2.zip'),
    f('Series Vol 3.pdf', '1', 'derivative'),
  ]);
  assert.deepEqual(picks, [{ volume: 1, name: 'Series Vol 1.pdf' }, { volume: 2, name: 'Series Vol 2.cbz' }]);
});

test('bestFile returns the single highest-scoring original file, or null', () => {
  assert.equal(bestFile([f('Book - Author.epub'), f('Book - Author.pdf'), f('Book_djvu.txt', '1', 'derivative')])!.name, 'Book - Author.pdf');
  assert.equal(bestFile([f('Book_djvu.txt'), f('Book.mobi'), f('Book.pdf', '1', 'derivative')]), null);
  assert.equal(bestFile([]), null);
});
