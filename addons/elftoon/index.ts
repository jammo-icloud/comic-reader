/**
 * Elf Toon connector — manhwa, manhua & comics.
 * Next.js site with a JSON search API and server-rendered chapter pages.
 */
import { createFetch, type MangaSource, type SearchResult, type ChapterResult } from '@bindery/addon-api';

const SITE_URL = 'https://elftoon.net';

const get = createFetch({ rateLimitMs: 300, referer: `${SITE_URL}/`, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });

async function fetchPage(url: string): Promise<string> {
  const res = await get(url);
  if (!res.ok) throw new Error(`Elf Toon fetch failed: ${res.status}`);
  return res.text();
}

async function fetchJson(url: string): Promise<any> {
  const res = await get(url);
  if (!res.ok) throw new Error(`Elf Toon API failed: ${res.status}`);
  return res.json();
}

interface ElftoonSeries {
  id: string;
  title: string;
  slug: string;
  urlSlug: string;
  coverImage: string;
  status: string;
  type: string;
  rating: number;
  chapterCount: number;
  isMature: boolean;
}

export const elftoonSource: MangaSource & { lastMetadata: any } = {
  id: 'elftoon',
  name: 'Elf Toon',

  async search(query: string, limit = 20): Promise<SearchResult[]> {
    const data = await fetchJson(
      `${SITE_URL}/api/search?q=${encodeURIComponent(query)}&contentMode=comics`,
    );

    const series: ElftoonSeries[] = data.series || [];
    return series.slice(0, limit).map((s) => ({
      sourceId: 'elftoon',
      sourceName: 'Elf Toon',
      mangaId: `comic/${s.urlSlug || s.slug}`,
      title: s.title,
      coverUrl: s.coverImage ? `${SITE_URL}${s.coverImage}` : null,
      description: '',
      status: s.status?.toLowerCase() || 'unknown',
      year: null,
      tags: [],
    }));
  },

  lastMetadata: null as any,

  async getChapters(mangaId: string): Promise<ChapterResult[]> {
    // mangaId is "comic/{slug}"
    const html = await fetchPage(`${SITE_URL}/series/${mangaId}`);

    // Extract metadata from LD+JSON Book schema
    let description = '';
    let genres: string[] = [];
    let coverUrl: string | null = null;
    const ldMatches = [...html.matchAll(/application\/ld\+json[^>]*>([^<]+)<\/script/g)];
    for (const m of ldMatches) {
      try {
        const ld = JSON.parse(m[1]);
        if (ld['@type'] === 'Book') {
          description = ld.description || '';
          genres = (ld.genre || []).map((g: string) => g.toLowerCase());
          if (ld.image) coverUrl = `${SITE_URL}${ld.image}`;
          break;
        }
      } catch { /* skip malformed JSON */ }
    }

    this.lastMetadata = { description, genres, coverUrl, year: null };

    // Extract chapter links — pattern: /chapter/N
    const chapters: ChapterResult[] = [];
    const seen = new Set<string>();
    const regex = /\/chapter\/(\d+(?:\.\d+)?)/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const num = match[1];
      if (seen.has(num)) continue;
      seen.add(num);
      chapters.push({
        sourceId: 'elftoon',
        chapterId: `${mangaId}/chapter/${num}`,
        chapter: String(parseFloat(num)),
        title: null,
        pages: 0,
        scanlationGroup: null,
      });
    }

    chapters.sort((a, b) => parseFloat(a.chapter || '0') - parseFloat(b.chapter || '0'));
    return chapters;
  },

  async getPageUrls(chapterId: string): Promise<string[]> {
    // chapterId is "comic/{slug}/chapter/{num}"
    const html = await fetchPage(`${SITE_URL}/series/${chapterId}`);

    // Page images live at /uploads/series/{slug}/c{id}/p{num}-{hash}.webp
    const pages: string[] = [];
    const regex = /\/uploads\/series\/[^"\\]+\.(?:webp|jpg|jpeg|png)/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const path = match[0];
      // Only chapter page images (contain /c{digits}/p{digits}), not covers
      if (/\/c\d+\/p\d+/.test(path) && !pages.includes(path)) {
        pages.push(`${SITE_URL}${path}`);
      }
    }

    return pages;
  },

  getMangaUrl(mangaId: string) {
    return `${SITE_URL}/series/${mangaId}`;
  },
};

export default elftoonSource;
