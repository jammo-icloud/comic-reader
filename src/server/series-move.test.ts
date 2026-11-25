import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { findSeriesDir, moveSeriesDir } from './series-move.js';

const tempLibs: string[] = [];

function tempLibrary(): string {
  const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'bindery-move-'));
  tempLibs.push(lib);
  return lib;
}

after(() => {
  for (const lib of tempLibs) fs.rmSync(lib, { recursive: true, force: true });
});

function exdev(): NodeJS.ErrnoException {
  const e = new Error('cross-device link not permitted') as NodeJS.ErrnoException;
  e.code = 'EXDEV';
  return e;
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

test('EXDEV falls back to copy + remove, including nested dirs', (t) => {
  const lib = tempLibrary();
  makeSeries(lib, 'comics', 'x');
  fs.mkdirSync(path.join(lib, 'comics', 'x', 'extras'));
  fs.writeFileSync(path.join(lib, 'comics', 'x', 'extras', 'b.pdf'), 'nested');
  t.after(() => mock.restoreAll());
  mock.method(fs, 'renameSync', () => { throw exdev(); });

  const r = moveSeriesDir(lib, 'x', 'comic', 'book');

  assert.equal(r.moved, true);
  assert.ok(fs.existsSync(path.join(lib, 'books', 'x', 'a.pdf')));
  assert.equal(fs.readFileSync(path.join(lib, 'books', 'x', 'extras', 'b.pdf'), 'utf-8'), 'nested');
  assert.ok(!fs.existsSync(path.join(lib, 'comics', 'x')));
});

test('failed EXDEV copy removes the partial target and keeps the source', (t) => {
  const lib = tempLibrary();
  makeSeries(lib, 'comics', 'x');
  t.after(() => mock.restoreAll());
  mock.method(fs, 'renameSync', () => { throw exdev(); });
  mock.method(fs, 'cpSync', (_src: string, dest: string) => {
    // Simulate a copy that dies midway (e.g. target mount full).
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, 'a.pdf'), 'da');
    const e = new Error('no space left on device') as NodeJS.ErrnoException;
    e.code = 'ENOSPC';
    throw e;
  });

  assert.throws(
    () => moveSeriesDir(lib, 'x', 'comic', 'book'),
    (e: NodeJS.ErrnoException) => e.code === 'ENOSPC',
  );
  assert.ok(!fs.existsSync(path.join(lib, 'books', 'x')));
  assert.equal(fs.readFileSync(path.join(lib, 'comics', 'x', 'a.pdf'), 'utf-8'), 'data');

  // A retry is no longer blocked by EEXIST.
  mock.restoreAll();
  assert.equal(moveSeriesDir(lib, 'x', 'comic', 'book').moved, true);
});
