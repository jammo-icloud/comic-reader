import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { findSeriesDir, moveSeriesDir } from './series-move.js';

function tempLibrary(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bindery-move-'));
}

function makeSeries(lib: string, dir: string, id: string, file = 'a.pdf'): void {
  fs.mkdirSync(path.join(lib, dir, id), { recursive: true });
  fs.writeFileSync(path.join(lib, dir, id, file), 'data');
}

test('moves folder from comics/ to books/', () => {
  const lib = tempLibrary();
  makeSeries(lib, 'comics', 'x');

  const r = moveSeriesDir(lib, 'x', 'comic', 'book');

  assert.equal(r.moved, true);
  assert.equal(r.from, path.join(lib, 'comics', 'x'));
  assert.equal(r.to, path.join(lib, 'books', 'x'));
  assert.ok(fs.existsSync(path.join(lib, 'books', 'x', 'a.pdf')));
  assert.ok(!fs.existsSync(path.join(lib, 'comics', 'x')));
});

test('finds folder under another type dir when record disagrees', () => {
  const lib = tempLibrary();
  makeSeries(lib, 'magazines', 'x');

  assert.equal(findSeriesDir(lib, 'x', 'comic'), path.join(lib, 'magazines', 'x'));
  const r = moveSeriesDir(lib, 'x', 'comic', 'book');

  assert.equal(r.moved, true);
  assert.equal(r.from, path.join(lib, 'magazines', 'x'));
  assert.ok(fs.existsSync(path.join(lib, 'books', 'x', 'a.pdf')));
  assert.ok(!fs.existsSync(path.join(lib, 'magazines', 'x')));
});

test('record-only when no folder exists', () => {
  const lib = tempLibrary();

  assert.equal(findSeriesDir(lib, 'x', 'comic'), null);
  const r = moveSeriesDir(lib, 'x', 'comic', 'book');

  assert.deepEqual(r, { moved: false, from: null, to: path.join(lib, 'books', 'x') });
  assert.ok(!fs.existsSync(path.join(lib, 'books', 'x')));
});

test('throws EEXIST when target already exists', () => {
  const lib = tempLibrary();
  makeSeries(lib, 'comics', 'x', 'a.pdf');
  makeSeries(lib, 'books', 'x', 'b.epub');

  assert.throws(
    () => moveSeriesDir(lib, 'x', 'comic', 'book'),
    (e: NodeJS.ErrnoException) => e.code === 'EEXIST',
  );
  // Neither folder was touched
  assert.ok(fs.existsSync(path.join(lib, 'comics', 'x', 'a.pdf')));
  assert.ok(fs.existsSync(path.join(lib, 'books', 'x', 'b.epub')));
  assert.ok(!fs.existsSync(path.join(lib, 'books', 'x', 'a.pdf')));
});

test('same type is a no-op', () => {
  const lib = tempLibrary();
  makeSeries(lib, 'comics', 'x');

  const r = moveSeriesDir(lib, 'x', 'comic', 'comic');

  assert.equal(r.moved, false);
  assert.ok(fs.existsSync(path.join(lib, 'comics', 'x', 'a.pdf')));
});
