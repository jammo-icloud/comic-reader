# Manga Sources — Research Notes

## Working (Server-side HTTP)

| Source | Type | Search | Chapters | Pages | Notes |
|--------|------|--------|----------|-------|-------|
| **MangaDex** | REST API | ✅ | ✅ | ✅ | Best API, community scanlations |
| **MyAnimeList** | REST API (Jikan) | ✅ | ❌ metadata only | ❌ | Scores, synopsis, covers. No content. |
| **MangaFox** (fanfox.net) | HTML scrape | ✅ | ✅ 215ch+ | ✅ via chapterfun.ashx | Needs CDN referer mapping |

## Needs Headless Browser (Cloudflare/WAF/JS)

| Source | Block Type | HakuNeko Connector | Notes |
|--------|-----------|-------------------|-------|
| **MangaHub** | Cloudflare | `MangaHub.mjs` | GraphQL API behind CF |
| **MangaFire** (mangafire.to) | WAF | `MangaFire.mjs` | HeanCms template, image tiles obfuscated |
| **KaliScan** (kaliscan.io) | Cloudflare | `ManhuaScan.mjs` | WordPressMadara template, backend API works |
| **HentaiNexus** | Encrypted pages | `HentaiNexus.mjs` | Search works, page images need JS decrypt |
| **MangaDNA** | Broken/empty | `MangaDNA.mjs` | WordPressMadara, returns empty responses |

## Not Viable

| Source | Issue |
|--------|-------|
| **MangaFreak** | 404 on search endpoints |
| **OmegaScans** | No search filtering in API (returns all, no keyword param) |

## Future: Headless Browser Solution

Adding Puppeteer/Playwright to the import orchestrator would unlock all CF/WAF sites.
Port HakuNeko's `.mjs` selectors directly. ~400MB Docker image increase.

Key HakuNeko templates to support:
- `WordPressMadara.mjs` — dozens of manga sites use this
- `HeanCms.mjs` — OmegaScans and similar
- `MadTheme.mjs` — KaliScan and similar

## CDN Referer Mappings

```
fmcdn.mfcdn.net → https://fanfox.net/
zjcdn.mangafox.me → https://fanfox.net/
```
