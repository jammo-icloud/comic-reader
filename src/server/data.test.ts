import { test } from 'node:test';
import assert from 'node:assert/strict';
import { typeDir, placeholderFor } from './data.js';

test('typeDir maps each series type to its library folder', () => {
  assert.equal(typeDir('comic'), 'comics');
  assert.equal(typeDir('magazine'), 'magazines');
  assert.equal(typeDir('book'), 'books');
});

test('placeholderFor maps each series type to its placeholder image', () => {
  assert.equal(placeholderFor('comic'), 'manga.png');
  assert.equal(placeholderFor('magazine'), 'magazine.png');
  assert.equal(placeholderFor('book'), 'book.png');
});

test("typeDir/placeholderFor fall back to magazine for an unknown runtime type", () => {
  assert.equal(typeDir("novel" as any), "magazines");
  assert.equal(placeholderFor("novel" as any), "magazine.png");
});
