/**
 * Rawkuma connector — raw Japanese manga reader at rawkuma.net.
 *
 * Note: the `.com` domain is just a redirect landing; actual content lives at .net.
 * The site is WordPress + HTMX-driven, so search and chapter list are loaded
 * via wp-admin/admin-ajax.php endpoints:
 *
 *   POST /wp-admin/admin-ajax.php?nonce=X&action=search          → search HTML
 *   GET  /wp-admin/admin-ajax.php?manga_id=X&page=1&action=chapter_list
 *   GET  /manga/{slug}/chapter-{num}.{id}/                       → chapter reader
 *
 * Images are served from a separate CDN with predictable URLs:
 *   https://rcdn.kyut.dev/o/{slug}/chapter-{num}/{N}.jpg
 * No auth tokens — once we fetch the reader page and count images, we're done.
 *
 * The nonce is rotated per session; we fetch a fresh one before each search.
 */
import type { MangaSource, SearchResult, ChapterResult } from './types.js';

const SITE_URL = 'https://rawkuma.net';
const AJAX_URL = `${SITE_URL}/wp-admin/admin-ajax.php`;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const RATE_LIMIT_MS = 400;

let lastRequest = 0;
let cachedNonce: { value: string; fetchedAt: number } | null = null;

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function rateLimit() {
  const wait = Math.max(0, RATE_LIMIT_MS - (Date.now() - lastRequest));
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();
}

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  await rateLimit();
  const res = await fetch(url, {
    ...init,
    headers: {
      'User-Agent': UA,
      'Referer': `${SITE_URL}/`,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Rawkuma fetch failed: ${res.status}`);
  return res.text();
}

/**
 * Fetch a search nonce from the home page. Cached for 5 minutes.
 */
async function getSearchNonce(): Promise<string> {
  if (cachedNonce && Date.now() - cachedNonce.fetchedAt < 5 * 60 * 1000) {
    return cachedNonce.value;
  }
  const html = await fetchText(`${SITE_URL}/`);
  const match = html.match(/nonce=([a-f0-9]+)[^"]*action=search/);
  if (!match) throw new Error('Rawkuma: could not extract search nonce');
  cachedNonce = { value: match[1], fetchedAt: Date.now() };
  return match[1];
}

/**
 * Extract the internal manga_id from a series detail page.
 */
async function getMangaId(slug: string): Promise<number | null> {
  const html = await fetchText(`${SITE_URL}/manga/${slug}/`);
  const match = html.match(/manga_id=(\d+)[^"]*action=chapter_list/);
  return match ? parseInt(match[1], 10) : null;
}

export const rawkumaSource: MangaSource = {
  id: 'rawkuma',
  name: 'Rawkuma',

  async search(query: string, limit = 20): Promise<SearchResult[]> {
    const nonce = await getSearchNonce();
    const body = `query=${encodeURIComponent(query)}`;
    const html = await fetchText(`${AJAX_URL}?nonce=${nonce}&action=search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body,
    });

    // Each result is <a href=".../manga/SLUG/" ...><img src="COVER"...><h3>TITLE</h3><p>DESC</p>
    const items: SearchResult[] = [];
    const regex = /<a\s+href="https:\/\/rawkuma\.net\/manga\/([^"/]+)\/"[\s\S]*?<img[^>]*src="([^"]+)"[^>]*alt="([^"]+)"[\s\S]*?<p[^>]*>([^<]*)<\/p>/g;
    let match;
    while ((match = regex.exec(html)) !== null && items.length < limit) {
      const [, slug, coverUrl, title, desc] = match;
      items.push({
        sourceId: 'rawkuma',
        sourceName: 'Rawkuma',
        mangaId: slug,
        title: title.replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim(),
        coverUrl,
        description: desc.replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim().slice(0, 400),
        status: 'unknown',
        year: null,
        tags: ['japanese', 'raw'],
      });
    }
    return items;
  },

  async getChapters(slug: string): Promise<ChapterResult[]> {
    const mangaId = await getMangaId(slug);
    if (!mangaId) {
      console.error(`Rawkuma: could not find manga_id for ${slug}`);
      return [];
    }

    const html = await fetchText(
      `${AJAX_URL}?manga_id=${mangaId}&page=1&action=chapter_list`,
      { headers: { 'Referer': `${SITE_URL}/manga/${slug}/` } },
    );

    // Chapter links: /manga/{slug}/chapter-{num}.{id}/
    const chapters: ChapterResult[] = [];
    const seen = new Set<string>();
    const slugEscaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      `href="https://rawkuma\\.net/manga/${slugEscaped}/(chapter-[\\d.]+\\.\\d+)/"`,
      'g',
    );
    let match;
    while ((match = regex.exec(html)) !== null) {
      const chapterPath = match[1]; // e.g. "chapter-999.128019"
      if (seen.has(chapterPath)) continue;
      seen.add(chapterPath);

      // Extract the chapter number (before the dot-ID)
      const numMatch = chapterPath.match(/chapter-([\d.]+)\.\d+/);
      const chapterNum = numMatch ? numMatch[1] : chapterPath;

      chapters.push({
        sourceId: 'rawkuma',
        chapterId: `${slug}/${chapterPath}`,
        chapter: String(parseFloat(chapterNum) || chapterNum),
        title: null,
        pages: 0,
        scanlationGroup: null,
      });
    }

    chapters.sort((a, b) => parseFloat(a.chapter || '0') - parseFloat(b.chapter || '0'));
    return chapters;
  },

  async getPageUrls(chapterId: string): Promise<string[]> {
    // chapterId is "slug/chapter-N.ID"
    const html = await fetchText(`${SITE_URL}/manga/${chapterId}/`);

    // Images are at rcdn.kyut.dev with a single-letter path prefix
    // that corresponds to the first letter of the slug (e.g. /o/one-piece/, /j/jujutsu-kaisen/).
    const urls: string[] = [];
    const seen = new Set<string>();
    const regex = /https:\/\/[^"'\s]+\/[a-z0-9]\/[^"'\s/]+\/chapter-[^/]+\/\d+\.(?:jpg|jpeg|png|webp)/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      if (!seen.has(match[0])) {
        seen.add(match[0]);
        urls.push(match[0]);
      }
    }

    // Sort by page number (extract trailing digits before the extension)
    urls.sort((a, b) => {
      const na = parseInt(a.match(/\/(\d+)\.\w+$/)?.[1] || '0', 10);
      const nb = parseInt(b.match(/\/(\d+)\.\w+$/)?.[1] || '0', 10);
      return na - nb;
    });

    return urls;
  },
};
