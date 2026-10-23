import { createFetch, type MangaSource, type SearchResult, type ChapterResult } from '@bindery/addon-api';

const API = 'https://api.omegascans.org';

const get = createFetch({ rateLimitMs: 300, referer: 'https://omegascans.org/', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });

async function fetchJson(url: string): Promise<any> {
  const res = await get(url);
  if (!res.ok) throw new Error(`Omega Scans API failed: ${res.status}`);
  return res.json();
}

interface OmegaSeries {
  id: number;
  title: string;
  description: string;
  series_slug: string;
  thumbnail: string;
  status: string;
  rating: number;
}

interface OmegaChapter {
  id: number;
  chapter_name: string;
  chapter_title: string | null;
  chapter_slug: string;
  price: number;
  series: { series_slug: string; id: number };
}

export const omegascansSource: MangaSource & { lastMetadata: any } = {
  id: 'omegascans',
  name: 'Omega Scans',

  async search(query: string, limit = 20): Promise<SearchResult[]> {
    const data = await fetchJson(
      `${API}/query?adult=true&query_string=${encodeURIComponent(query)}`,
    );

    const series: OmegaSeries[] = data.data || [];
    return series.slice(0, limit).map((s) => ({
      sourceId: 'omegascans',
      sourceName: 'Omega Scans',
      mangaId: String(s.id),
      title: s.title,
      coverUrl: s.thumbnail
        ? `/api/discover/proxy-image?url=${encodeURIComponent(s.thumbnail)}`
        : null,
      description: s.description?.replace(/\n/g, ' ').trim() || '',
      status: s.status?.toLowerCase() || 'unknown',
      year: null,
      tags: ['adult'],
      slug: s.series_slug,
    }));
  },

  lastMetadata: null as any,

  async getChapters(mangaId: string): Promise<ChapterResult[]> {
    const data = await fetchJson(
      `${API}/chapter/query?series_id=${mangaId}&perPage=9999`,
    );

    const chapters: OmegaChapter[] = data.data || [];
    const seriesSlug = chapters[0]?.series?.series_slug || '';

    this.lastMetadata = { seriesSlug };

    return chapters
      .filter((ch) => ch.price === 0)
      .map((ch) => ({
        sourceId: 'omegascans',
        chapterId: `${seriesSlug}/${ch.chapter_slug}`,
        chapter: ch.chapter_name.replace(/^Chapter\s+/i, ''),
        title: ch.chapter_title || null,
        pages: 0,
        scanlationGroup: null,
      }))
      .sort((a, b) => parseFloat(a.chapter || '0') - parseFloat(b.chapter || '0'));
  },

  async getPageUrls(chapterId: string): Promise<string[]> {
    const data = await fetchJson(`${API}/chapter/${chapterId}`);
    const images: string[] = data.chapter?.chapter_data?.images || [];
    return images;
  },
};

export default omegascansSource;
