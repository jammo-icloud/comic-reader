import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseEpubStrategy, visibleTextLength, TEXT_CHARS_PER_IMAGE } from './epub-converter.js';

test('manga EPUB: many images, a few credits lines → images', () => {
  assert.equal(chooseEpubStrategy({ imageCount: 24, textChars: 300 }), 'images');
});

test('manga volume with a long afterword still extracts images', () => {
  assert.equal(chooseEpubStrategy({ imageCount: 200, textChars: 5000 }), 'images');
});

test('prose novel: cover plus a few plates against a lot of text → render', () => {
  assert.equal(chooseEpubStrategy({ imageCount: 6, textChars: 300_000 }), 'render');
});

test('short story with one cover image → render', () => {
  assert.equal(chooseEpubStrategy({ imageCount: 1, textChars: 8000 }), 'render');
});

test('text-only EPUB → render even when the text is short', () => {
  assert.equal(chooseEpubStrategy({ imageCount: 0, textChars: 50 }), 'render');
});

test('threshold is text per image', () => {
  assert.equal(chooseEpubStrategy({ imageCount: 10, textChars: 10 * TEXT_CHARS_PER_IMAGE }), 'images');
  assert.equal(chooseEpubStrategy({ imageCount: 10, textChars: 10 * TEXT_CHARS_PER_IMAGE + 1 }), 'render');
});

test('visibleTextLength ignores head, style, script and markup', () => {
  const html = `<?xml version="1.0"?>
    <html><head><title>Chapter 1</title><style>p { margin: 0 }</style></head>
    <body><!-- note --><script>var x = 1;</script>
    <h1>Chapter   One</h1><p>It is a truth&nbsp;universally acknowledged.</p>
    <img src="../images/cover.jpg" alt=""/></body></html>`;
  // "Chapter One It is a truth universally acknowledged." with the entity counted once
  assert.equal(visibleTextLength(html), 'Chapter One It is a truth universally acknowledged.'.length);
});

test('visibleTextLength of an image-only page is zero', () => {
  const html = `<html><head><title>p001</title></head><body><div><img src="001.jpg"/></div></body></html>`;
  assert.equal(visibleTextLength(html), 0);
});
