/**
 * ReadAllComics connector — Western comics (DC, Marvel, etc.)
 * WordPress site with Blogger/Google CDN images.
 * No Cloudflare, no encryption — works server-side.
 */
import type { MangaSource, SearchResult, ChapterResult } from './types.js';

const SITE_URL = 'https://readallcomics.com';
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
  if (!res.ok) throw new Error(`ReadAllComics fetch failed: ${res.status}`);
  return res.text();
}

export const readallcomicsSource: MangaSource & { lastMetadata: any } = {
  id: 'readallcomics',
  name: 'ReadAllComics',

  async search(query: string, limit = 20): Promise<SearchResult[]> {
    const html = await fetchPage(`${SITE_URL}/?story=${encodeURIComponent(query)}&s=&type=comic`);

    const items: SearchResult[] = [];
    const coverRegex = /<img\s+src="([^"]*)"[^>]*class="book-cover"[^>]*alt="([^"]*)"/g;
    const titleRegex = /href="https:\/\/readallcomics\.com\/category\/([^/]+)\/"[^>]*class="cat-title">([^<]+)/g;

    const covers: { url: string }[] = [];
    let match;
    while ((match = coverRegex.exec(html)) !== null) {
      covers.push({ url: match[1] });
    }

    let idx = 0;
    while ((match = titleRegex.exec(html)) !== null && items.length < limit) {
      const [, slug, title] = match;
      items.push({
        sourceId: 'readallcomics',
        sourceName: 'ReadAllComics',
        mangaId: slug,
        title: title.trim(),
        coverUrl: covers[idx]?.url || null,
        description: '',
        status: 'unknown',
        year: null,
        tags: ['western', 'comics'],
      });
      idx++;
    }

    return items;
  },

  /**
   * Extract metadata from the category page (called during chapter fetch).
   * Stored as a side-effect so the downloader can use it.
   */
  lastMetadata: null as { description: string; genres: string[]; publisher: string; coverUrl: string | null; year: number | null } | null,

  async getChapters(mangaSlug: string): Promise<ChapterResult[]> {
    const html = await fetchPage(`${SITE_URL}/category/${mangaSlug}/`);

    // Extract metadata from description-archive block
    const descBlock = html.match(/class="description-archive"[\s\S]*?<\/div>\s*<\/div>\s*<\/center>/i)?.[0] || '';

    // Synopsis — text after <strong> blocks, before </div>
    const synopsisMatch = descBlock.match(/<\/strong>\s*<\/p>\s*<\/div>([\s\S]*?)<\/div>/);
    let synopsis = '';
    if (!synopsisMatch) {
      // Try alternate pattern — text after <hr> tag
      const altMatch = descBlock.match(/<strong>([\s\S]*?)<\/strong>\s*<\/p>/g);
      if (altMatch) {
        const lastStrong = altMatch[altMatch.length - 1];
        const textMatch = lastStrong.match(/<strong>([\s\S]*?)<\/strong>/);
        if (textMatch) synopsis = textMatch[1].replace(/<[^>]+>/g, '').trim();
      }
    } else {
      synopsis = synopsisMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    // Genres
    const genresMatch = descBlock.match(/Genres:\s*<strong>([^<]+)<\/strong>/i);
    const genres = genresMatch ? genresMatch[1].split(',').map((g) => g.trim().toLowerCase()) : [];

    // Publisher
    const pubMatch = descBlock.match(/Publisher:\s*<strong>([^<]+)<\/strong>/i);
    const publisher = pubMatch ? pubMatch[1].trim() : '';

    // Cover from description block
    const coverMatch = descBlock.match(/<img[^>]*src="([^"]+)"/);
    const descCover = coverMatch ? coverMatch[1] : null;

    // Year from "Vol 1: October 2003" or similar
    const yearMatch = descBlock.match(/(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

    this.lastMetadata = { description: synopsis, genres, publisher, coverUrl: descCover, year };

    const chapters: ChapterResult[] = [];
    const regex = /href="https:\/\/readallcomics\.com\/([^"]+)\/"[^>]*>\s*([^<]+)/g;
    const seen = new Set<string>();
    let match;

    while ((match = regex.exec(html)) !== null) {
      const [, slug, text] = match;
      if (slug.includes('category') || slug.includes('report') || slug.includes('request') ||
          slug.includes('vip') || slug.includes('comment') || slug.includes('page/') ||
          slug.includes('?') || slug === '' || slug === mangaSlug) continue;

      const title = text.trim();
      if (!title || seen.has(slug)) continue;
      seen.add(slug);

      const numMatch = title.match(/(\d+)/) || slug.match(/(\d+)/);
      const num = numMatch ? numMatch[1] : String(chapters.length + 1);

      chapters.push({
        sourceId: 'readallcomics',
        chapterId: slug,
        chapter: num,
        title,
        pages: 0,
        scanlationGroup: null,
      });
    }

    chapters.sort((a, b) => parseFloat(a.chapter || '0') - parseFloat(b.chapter || '0'));
    return chapters;
  },

  async getPageUrls(chapterId: string): Promise<string[]> {
    const html = await fetchPage(`${SITE_URL}/${chapterId}/`);

    const pages: string[] = [];
    const regex = /src="(https:\/\/(?:blogger\.googleusercontent\.com|[0-9]+\.bp\.blogspot\.com)[^"]+)"/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
      const url = match[1].replace(/&#038;/g, '&');
      if (!pages.includes(url)) pages.push(url);
    }

    return pages;
  },
};
