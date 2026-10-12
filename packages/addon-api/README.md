# @bindery/addon-api

Types and helpers for writing [Bindery](https://github.com/jammo-icloud/comic-reader) add-ons.

An add-on is a folder with an `addon.json` manifest and the module it names as
`main`. Bindery loads add-ons from its bundled `addons/` directory and from
`<DATA_DIR>/addons/`.

## A source add-on

```
my-source/
  addon.json
  index.js
```

`addon.json`:

```json
{
  "id": "my-source",
  "name": "My Source",
  "version": "1.0.0",
  "api": 1,
  "kind": "source",
  "main": "index.js",
  "hosts": ["example.com"],
  "color": "#0284c7",
  "description": "What this source is good for.",
  "url": "https://example.com",
  "favicon": "https://example.com/favicon.ico"
}
```

`index.js`:

```js
import { defineSource, createFetch } from '@bindery/addon-api';

const get = createFetch({ rateLimitMs: 300, referer: 'https://example.com/' });

export default defineSource({
  id: 'my-source',
  name: 'My Source',
  async search(query, limit = 20) { /* return SearchResult[] */ },
  async getChapters(mangaId) { /* return ChapterResult[] */ },
  async getPageUrls(chapterId) { /* return image URLs, or one PDF/CBZ URL */ },
});
```

Add-ons run inside the Bindery server with the same access it has. Install
only add-ons you trust.
