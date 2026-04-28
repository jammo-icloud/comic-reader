/**
 * MangaTown connector — HTML scraping.
 * Search: /search.php?name=...
 * Chapters: /manga/{slug}/ contains <ul class="chapter_list">
 * Pages: /manga/{slug}/vXX/cYY/N.html — image at //zjcdn.mangahere.org/store/manga/{id}/{chap}/compressed/bNNN.jpg
 * No per-page auth tokens — URLs are predictable once we fetch page 1.
 */
import type { MangaSource, SearchResult, ChapterResult } from './types.js';

const SITE_URL = 'https://www.mangatown.com';
const RATE_LIMIT_MS = 300;

let lastRequest = 0;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(url: string): Promise<string> {
  const now = Date.now();
  const wait = Math.max(0, RATE_LIMIT_MS - (now - lastRequest));
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': `${SITE_URL}/`,
    },
  });
  if (!res.ok) throw new Error(`MangaTown fetch failed: ${res.status}`);
  return res.text();
}

export const mangatownSource: MangaSource = {
  id: 'mangatown',
  name: 'MangaTown',

  async search(query: string, limit = 20): Promise<SearchResult[]> {
    const html = await fetchPage(`${SITE_URL}/search.php?name=${encodeURIComponent(query)}`);

    const items: SearchResult[] = [];
    // Each result is: <li><a class="manga_cover" href="/manga/{slug}/" title="{title}"><img ... /></a>
    // Capture the whole anchor body so we can robustly find the cover URL
    // regardless of <img> attribute order or lazy-loading.
    const blockRegex = /<a\s+class="manga_cover"\s+href="\/manga\/([^"/]+)\/"\s+title="([^"]+)"([\s\S]*?)<\/a>/g;
    let match;
    while ((match = blockRegex.exec(html)) !== null && items.length < limit) {
      const [, slug, title, blockHtml] = match;

      // Prefer data-src (lazy-loaded real URL) over src (often a placeholder
      // GIF when lazy-loading is in use). Fall back to src only if it looks
      // like an actual image URL — guard against grabbing a 1×1 spacer.
      const dataSrcMatch = blockHtml.match(/data-src="([^"]+)"/i);
      const srcMatch = blockHtml.match(/\bsrc="([^"]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^"]*)?)"/i);
      const rawCover = dataSrcMatch?.[1] || srcMatch?.[1] || '';
      const normalizedCover = rawCover.startsWith('//') ? `https:${rawCover}` : rawCover;

      items.push({
        sourceId: 'mangatown',
        sourceName: 'MangaTown',
        mangaId: slug,
        title: title.trim(),
        // Drop known placeholder URLs so the UI shows a clean fallback
        // instead of a 1×1 grey square that later 403s on cover download.
        coverUrl:
          !normalizedCover ||
          /manga_cover\.jpg|grey\.gif|loading\.gif|placeholder/i.test(normalizedCover)
            ? null
            : normalizedCover,
        description: '',
        status: 'unknown',
        year: null,
        tags: [],
      });
    }

    return items;
  },

  async getChapters(mangaSlug: string): Promise<ChapterResult[]> {
    const html = await fetchPage(`${SITE_URL}/manga/${mangaSlug}/`);

    const chapters: ChapterResult[] = [];
    // Chapter list: <ul class="chapter_list">...<li><a href="/manga/{slug}/vXX/cYY.Y/"...>
    // Also handles chapters without volume: /manga/{slug}/cYY/
    // And chapters with suffix qualifiers: /manga/{slug}/cYY-extra/
    const listMatch = html.match(/<ul\s+class="chapter_list">([\s\S]*?)<\/ul>/);
    if (!listMatch) return chapters;
    const listHtml = listMatch[1];

    // Capture the FULL href — don't reconstruct a synthetic path from parsed
    // pieces. MangaTown URLs sometimes include suffix qualifiers (`-special`,
    // `-extra`) or non-standard segments that the synthetic rebuild dropped,
    // producing chapter IDs that 404 on the page-fetch in getPageUrls. The
    // result was 219 chapters listed, only ~5 actually downloadable, with
    // every failure swallowed silently downstream. Use the literal href.
    const linkRegex = /<a\s+href="(\/manga\/[^"]+?\/c[\d.]+(?:[-_][^"\/]+)?\/?)"[^>]*>/g;
    const seen = new Set<string>();
    let match;
    while ((match = linkRegex.exec(listHtml)) !== null) {
      const fullPath = match[1]; // e.g. "/manga/lone-necromancer/v01/c1.5/"
      const expectedPrefix = `/manga/${mangaSlug}/`;
      // Defend against the chapter_list block accidentally containing related-
      // manga links (different slug). Skip anything not for our manga.
      if (!fullPath.startsWith(expectedPrefix)) continue;

      // Pull chNum + optional vol off the captured path for sort + dedup.
      const chMatch = fullPath.match(/\/c([\d.]+)(?:[-_][^/]+)?\/?$/);
      if (!chMatch) continue;
      const chNum = chMatch[1];
      const volMatch = fullPath.match(/\/v([\d.]+)\//);
      const vol = volMatch ? volMatch[1] : '';

      const key = `${vol}/${chNum}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // chapterId = path minus the "/manga/" prefix and trailing slash.
      // INCLUDES the slug — getPageUrls prepends "/manga/" to round-trip,
      // so chapterId must be e.g. "lone-necromancer/c021" or
      // "lone-necromancer/v01/c1.5". (Earlier version sliced off the slug
      // too, producing chapterIds like "c021" that resolved to
      // /manga/c021/1.html — MangaTown's homepage — and failed.)
      const chapterId = fullPath
        .slice('/manga/'.length)
        .replace(/\/$/, '');

      chapters.push({
        sourceId: 'mangatown',
        chapterId,
        chapter: String(parseFloat(chNum)),
        title: null,
        pages: 0,
        scanlationGroup: null,
      });
    }

    chapters.sort((a, b) => parseFloat(a.chapter || '0') - parseFloat(b.chapter || '0'));
    return chapters;
  },

  async getPageUrls(chapterId: string): Promise<string[]> {
    // chapterId is like "kimi_no_kakera/v01/c001" or "kimi_no_kakera/c001"
    const firstPageUrl = `${SITE_URL}/manga/${chapterId}/1.html`;
    const html = await fetchPage(firstPageUrl);

    // Extract total_pages from JS
    const totalMatch = html.match(/var\s+total_pages\s*=\s*(\d+)/);
    if (!totalMatch) {
      console.error(`MangaTown: could not find total_pages for ${chapterId}`);
      return [];
    }
    const totalPages = parseInt(totalMatch[1], 10);

    // Find the page-1 image URL. MangaTown has shuffled CDNs over the years
    // (zjcdn.mangahere.org → mangahere.cc → others), so we try patterns from
    // most-specific to most-permissive. The first hit wins; whichever pattern
    // matches, we then derive a numeric-component template from the URL.
    const imgPatterns: RegExp[] = [
      // Original: //zjcdn.mangahere.org/store/manga/.../compressed/b001.jpg
      /<img[^>]*\bsrc="(\/\/[^"]+\/compressed\/b\d+\.jpg[^"]*)"/i,
      // Same shape but lazy-loaded via data-src
      /<img[^>]*\bdata-src="(\/\/[^"]+\/compressed\/b\d+\.jpg[^"]*)"/i,
      // MangaHere variants without /compressed/: /store/manga/.../001.jpg
      /<img[^>]*\bsrc="(\/\/[^"]+\/store\/manga\/[^"]+\d+\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
      // Modern reader pattern — img with id="image"
      /<img[^>]*\bid=["']?image["']?[^>]*\bsrc="(\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
      // Inside a viewer/reader/page container
      /<(?:div|section)[^>]+(?:id|class)="[^"]*(?:viewer|reader|page-image|read-page)[^"]*"[\s\S]{0,400}?<img[^>]*\b(?:src|data-src)="(\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
    ];

    let captured: string | null = null;
    for (const pattern of imgPatterns) {
      const m = html.match(pattern);
      if (m) { captured = m[1]; break; }
    }

    if (!captured) {
      // Dump a sample of the page's <img> tags so we can update the patterns
      // without round-tripping through the user's browser. Limited to the
      // first few image-shaped tags to keep logs readable.
      const samples = (html.match(/<img[^>]+(?:src|data-src)="[^"]+\.(?:jpg|jpeg|png|webp)[^"]*"[^>]*>/gi) || [])
        .slice(0, 3)
        .map((s) => s.length > 240 ? s.slice(0, 240) + '…' : s)
        .join('\n    ');
      console.error(
        `MangaTown: could not find image URL template for ${chapterId}.\n` +
        `  total_pages found (${totalPages}); URL was ${firstPageUrl}\n` +
        `  Sample <img> tags from page:\n    ${samples || '(none matched)'}`,
      );
      return [];
    }

    const templateUrl = captured.startsWith('//') ? `https:${captured}` : captured;

    // Decompose the URL into prefix + numeric-page-component + suffix so we
    // can swap the digits for any padding (b001 vs 0001 vs 001 vs page-001).
    // Example matches:
    //   .../compressed/b001.jpg   → prefix=".../compressed/b", num="001", suffix=".jpg"
    //   .../page-001.jpg?v=2      → prefix=".../page-", num="001", suffix=".jpg?v=2"
    //   .../store/manga/x/001.jpg → prefix=".../store/manga/x/", num="001", suffix=".jpg"
    const partsMatch = templateUrl.match(/^(.+?)(\d+)(\.(?:jpg|jpeg|png|webp)(?:\?[^"]*)?)$/i);
    if (!partsMatch) {
      console.error(
        `MangaTown: image URL ${templateUrl} has no numeric page component — can't template`,
      );
      return [];
    }
    const [, prefix, originalNum, suffix] = partsMatch;
    const padding = originalNum.length;

    const urls: string[] = [];
    for (let i = 1; i <= totalPages; i++) {
      urls.push(`${prefix}${String(i).padStart(padding, '0')}${suffix}`);
    }
    return urls;
  },
};
