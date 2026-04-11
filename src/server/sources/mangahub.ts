import type { MangaSource, SearchResult, ChapterResult } from './types.js';

const API_URL = 'https://api.mghcdn.com/graphql';
const CDN_URL = 'https://imgx.mghcdn.com';
const SITE_URL = 'https://mangahub.io';
const RATE_LIMIT_MS = 500;

let lastRequest = 0;
let apiKey: string | null = null;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function rateLimitedFetch(url: string, init?: RequestInit): Promise<Response> {
  const now = Date.now();
  const wait = Math.max(0, RATE_LIMIT_MS - (now - lastRequest));
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();
  return fetch(url, init);
}

/**
 * Get/refresh the API access key from MangaHub
 */
async function getApiKey(): Promise<string> {
  if (apiKey) return apiKey;

  try {
    const res = await fetch(SITE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    const cookies = res.headers.getSetCookie?.() || [];
    for (const cookie of cookies) {
      const match = cookie.match(/mhub_access=([^;]+)/);
      if (match) {
        apiKey = match[1];
        return apiKey;
      }
    }
    // Fallback — try without key
    apiKey = '';
    return apiKey;
  } catch {
    apiKey = '';
    return apiKey;
  }
}

async function graphql(query: string, variables: Record<string, any> = {}): Promise<any> {
  const key = await getApiKey();

  const res = await rateLimitedFetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-mhub-access': key || '',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Origin': SITE_URL,
      'Referer': `${SITE_URL}/`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    // Try refreshing key on 403
    if (res.status === 403) {
      apiKey = null;
      return graphql(query, variables);
    }
    throw new Error(`MangaHub API error: ${res.status}`);
  }

  const json = await res.json();
  if (json.errors) {
    // Key might be invalid — refresh and retry once
    if (JSON.stringify(json.errors).includes('key')) {
      apiKey = null;
      return graphql(query, variables);
    }
    throw new Error(`MangaHub GraphQL error: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

// ==================== MangaHub Source ====================

export const mangahubSource: MangaSource = {
  id: 'mangahub',
  name: 'MangaHub',

  async search(query: string, limit = 20): Promise<SearchResult[]> {
    const data = await graphql(`
      query ($q: String!, $limit: Int, $offset: Int) {
        search(x: m01, q: $q, mod: POPULAR, limit: $limit, offset: 0, count: true) {
          rows {
            id
            title
            slug
            image
            latestChapter
            status
            genres
            description
          }
          count
        }
      }
    `, { q: query, limit });

    const rows = data?.search?.rows || [];

    return rows.map((r: any) => ({
      sourceId: 'mangahub',
      sourceName: 'MangaHub',
      mangaId: r.slug || r.id?.toString(),
      title: r.title || 'Untitled',
      coverUrl: r.image ? `/api/discover/proxy-image?url=${encodeURIComponent(r.image)}` : null,
      description: r.description || '',
      status: r.status || 'unknown',
      year: null,
      tags: (r.genres || '').split(',').map((g: string) => g.trim()).filter(Boolean),
    }));
  },

  async getChapters(mangaSlug: string): Promise<ChapterResult[]> {
    const data = await graphql(`
      query ($slug: String!) {
        manga(x: m01, slug: $slug) {
          chapters {
            id
            number
            title
            slug
            date
          }
        }
      }
    `, { slug: mangaSlug });

    const chapters = data?.manga?.chapters || [];

    return chapters.map((ch: any) => ({
      sourceId: 'mangahub',
      chapterId: ch.slug || ch.id?.toString(),
      chapter: ch.number?.toString() || null,
      title: ch.title || null,
      pages: 0, // MangaHub doesn't return page count in chapter list
      scanlationGroup: null,
    }));
  },

  async getPageUrls(chapterSlug: string): Promise<string[]> {
    const data = await graphql(`
      query ($slug: String!) {
        chapter(x: m01, slug: $slug) {
          pages
        }
      }
    `, { slug: chapterSlug });

    const pagesStr = data?.chapter?.pages;
    if (!pagesStr) return [];

    try {
      // Pages come as a JSON string like: {"i": ["hash/1.jpg", "hash/2.jpg", ...]}
      const parsed = JSON.parse(pagesStr);
      const images = parsed.i || parsed.p || Object.values(parsed).flat();

      return images.map((img: string) =>
        img.startsWith('http') ? img : `${CDN_URL}/${img}`
      );
    } catch {
      return [];
    }
  },
};
