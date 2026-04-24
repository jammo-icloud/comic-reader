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
    // Each result is: <li><a class="manga_cover" href="/manga/{slug}/" title="{title}"><img src="{cover}" ... /></a>
    const regex = /<a\s+class="manga_cover"\s+href="\/manga\/([^"/]+)\/"\s+title="([^"]+)"[\s\S]*?<img\s+src="([^"]+)"/g;
    let match;
    while ((match = regex.exec(html)) !== null && items.length < limit) {
      const [, slug, title, coverUrl] = match;
      // Some cover images are the placeholder/error image — we skip those
      const normalizedCover = coverUrl.startsWith('//') ? `https:${coverUrl}` : coverUrl;
      items.push({
        sourceId: 'mangatown',
        sourceName: 'MangaTown',
        mangaId: slug,
        title: title.trim(),
        coverUrl: normalizedCover.includes('manga_cover.jpg') ? null : normalizedCover,
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
    const listMatch = html.match(/<ul\s+class="chapter_list">([\s\S]*?)<\/ul>/);
    if (!listMatch) return chapters;
    const listHtml = listMatch[1];

    const linkRegex = /<a\s+href="\/manga\/[^"]+\/(?:(v[\d.]+)\/)?c([\d.]+)\/?[^"]*"\s*(?:name="[^"]*")?\s*>/g;
    const seen = new Set<string>();
    let match;
    while ((match = linkRegex.exec(listHtml)) !== null) {
      const [, vol, chNum] = match;
      const key = `${vol || ''}/${chNum}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const chapterPath = vol ? `${mangaSlug}/${vol}/c${chNum}` : `${mangaSlug}/c${chNum}`;
      chapters.push({
        sourceId: 'mangatown',
        chapterId: chapterPath,
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

    // Extract the image URL from page 1 — it's the template for all pages
    // Pattern: //zjcdn.mangahere.org/store/manga/{id}/{chap}/compressed/b001.jpg
    const imgMatch = html.match(/<img[^>]*src="(\/\/[^"]+\/compressed\/b\d+\.jpg[^"]*)"/);
    if (!imgMatch) {
      console.error(`MangaTown: could not find image URL template for ${chapterId}`);
      return [];
    }

    const templateUrl = imgMatch[1].startsWith('//') ? `https:${imgMatch[1]}` : imgMatch[1];
    const templateBase = templateUrl.replace(/b\d+\.jpg[^"]*$/, '');

    // Generate all page URLs
    const urls: string[] = [];
    for (let i = 1; i <= totalPages; i++) {
      const paddedNum = String(i).padStart(3, '0');
      urls.push(`${templateBase}b${paddedNum}.jpg`);
    }

    return urls;
  },
};
