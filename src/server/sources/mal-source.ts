import type { MangaSource, SearchResult, ChapterResult } from './types.js';

const JIKAN_BASE = 'https://api.jikan.moe/v4';
const RATE_LIMIT_MS = 400;

let lastRequest = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const wait = Math.max(0, RATE_LIMIT_MS - (now - lastRequest));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();
  return fetch(url);
}

export const malSource: MangaSource = {
  id: 'mal',
  name: 'MyAnimeList',

  async search(query: string, limit = 20): Promise<SearchResult[]> {
    const res = await rateLimitedFetch(
      `${JIKAN_BASE}/manga?q=${encodeURIComponent(query)}&limit=${limit}&sfw=true`
    );

    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2000));
      return this.search(query, limit);
    }

    if (!res.ok) return [];

    const json = await res.json();
    const results = json.data || [];

    return results.map((r: any) => {
      const titleObj = r.titles?.[0];
      const title = titleObj?.title || r.title || 'Untitled';

      const imageUrl = r.images?.jpg?.large_image_url || r.images?.jpg?.image_url || null;
      // Proxy through our server to avoid CORS
      const coverUrl = imageUrl ? `/api/discover/proxy-image?url=${encodeURIComponent(imageUrl)}` : null;

      return {
        sourceId: 'mal',
        sourceName: 'MyAnimeList',
        mangaId: String(r.mal_id),
        title,
        coverUrl,
        description: r.synopsis || '',
        status: r.status?.toLowerCase() || 'unknown',
        year: r.published?.prop?.from?.year || null,
        tags: (r.genres || []).map((g: any) => g.name).filter(Boolean),
      };
    });
  },

  // MAL doesn't have chapters to download — it's metadata only
  async getChapters(_mangaId: string): Promise<ChapterResult[]> {
    return [];
  },

  async getPageUrls(_chapterId: string): Promise<string[]> {
    return [];
  },
};
