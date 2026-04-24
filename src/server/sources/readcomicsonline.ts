/**
 * ReadComicsOnline connector (readcomicsonline.ru).
 * Western comics — Batman, Marvel, DC, Image, etc.
 *
 * Search: JSON endpoint /search?query=... returns {suggestions: [{value, data}]}
 * Chapters: /comic/{slug} has <a href=".../comic/{slug}/{chapter}"> list
 * Pages: /comic/{slug}/{ch} has <img data-src="..."> for each page
 * Covers: /uploads/manga/{slug}/cover/cover_250x350.jpg
 */
import type { MangaSource, SearchResult, ChapterResult } from './types.js';

const SITE_URL = 'https://readcomicsonline.ru';
const RATE_LIMIT_MS = 300;

let lastRequest = 0;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRateLimit(url: string, asJson = false): Promise<string> {
  const now = Date.now();
  const wait = Math.max(0, RATE_LIMIT_MS - (now - lastRequest));
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': asJson ? 'application/json' : 'text/html',
      'Referer': `${SITE_URL}/`,
    },
  });
  if (!res.ok) throw new Error(`ReadComicsOnline fetch failed: ${res.status}`);
  return res.text();
}

function coverUrlFor(slug: string): string {
  return `${SITE_URL}/uploads/manga/${slug}/cover/cover_250x350.jpg`;
}

export const readcomicsonlineSource: MangaSource = {
  id: 'readcomicsonline',
  name: 'ReadComicsOnline',

  async search(query: string, limit = 20): Promise<SearchResult[]> {
    const json = await fetchWithRateLimit(
      `${SITE_URL}/search?query=${encodeURIComponent(query)}`,
      true,
    );

    let parsed: { suggestions?: { value: string; data: string }[] };
    try {
      parsed = JSON.parse(json);
    } catch {
      return [];
    }

    const suggestions = parsed.suggestions || [];
    return suggestions.slice(0, limit).map((s) => ({
      sourceId: 'readcomicsonline',
      sourceName: 'ReadComicsOnline',
      mangaId: s.data, // e.g. "batman-2016"
      title: s.value,  // e.g. "Batman (2016-)"
      coverUrl: coverUrlFor(s.data),
      description: '',
      status: 'unknown',
      year: null,
      tags: ['western', 'comics'],
    }));
  },

  async getChapters(mangaSlug: string): Promise<ChapterResult[]> {
    const html = await fetchWithRateLimit(`${SITE_URL}/comic/${mangaSlug}`);

    // Extract chapter list — links like https://readcomicsonline.ru/comic/{slug}/{chapter}
    const chapters: ChapterResult[] = [];
    const seen = new Set<string>();
    const linkRegex = new RegExp(
      `<a href="${SITE_URL.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}/comic/${mangaSlug.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}/([^"/]+)"`,
      'g',
    );
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const chapterIdRaw = match[1];
      if (seen.has(chapterIdRaw)) continue;
      seen.add(chapterIdRaw);

      // Try to extract a numeric chapter number for sorting
      // Handles "1", "10", "Annual-3", "annual2022", etc.
      const numMatch = chapterIdRaw.match(/(\d+(?:\.\d+)?)/);
      const chapterNum = numMatch ? numMatch[1] : chapterIdRaw;

      chapters.push({
        sourceId: 'readcomicsonline',
        chapterId: `${mangaSlug}/${chapterIdRaw}`,
        chapter: String(parseFloat(chapterNum) || chapterIdRaw),
        title: /annual|special/i.test(chapterIdRaw) ? chapterIdRaw : null,
        pages: 0,
        scanlationGroup: null,
      });
    }

    // Sort by numeric chapter — annuals/specials sort by their embedded number
    chapters.sort((a, b) => {
      const aNum = parseFloat(a.chapter || '0');
      const bNum = parseFloat(b.chapter || '0');
      return aNum - bNum;
    });
    return chapters;
  },

  async getPageUrls(chapterId: string): Promise<string[]> {
    // chapterId is like "batman-2016/1" or "batman-2016/Annual-3"
    const html = await fetchWithRateLimit(`${SITE_URL}/comic/${chapterId}`);

    // Extract all page image URLs from <img data-src='...'>
    const urls: string[] = [];
    const regex = /<img[^>]*data-src=['"]?\s*(https?:\/\/[^"'\s]+\.jpg)\s*['"]?/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const url = match[1];
      if (url.includes('/uploads/manga/') && !urls.includes(url)) {
        urls.push(url);
      }
    }

    return urls;
  },
};
