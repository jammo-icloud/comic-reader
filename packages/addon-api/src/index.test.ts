import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFileUrl, fileKind } from './index.js';

test('isFileUrl recognises file downloads by path extension, ignoring query', () => {
  assert.equal(isFileUrl('https://archive.org/download/x/Book%201.pdf'), true);
  assert.equal(isFileUrl('https://archive.org/download/x/vol1.CBZ?download=1'), true);
  assert.equal(isFileUrl('https://archive.org/download/x/book.epub#frag'), true);
  assert.equal(isFileUrl('https://cdn.example.com/pages/001.jpg'), false);
  assert.equal(isFileUrl('node|hash|file.jpg'), false);
});

test('fileKind classifies pdf, archive and epub', () => {
  assert.equal(fileKind('https://a/b.pdf'), 'pdf');
  assert.equal(fileKind('https://a/b.cbr'), 'archive');
  assert.equal(fileKind('https://a/b.zip'), 'archive');
  assert.equal(fileKind('https://a/b.epub'), 'epub');
  assert.equal(fileKind('https://a/b.jpg'), null);
});
