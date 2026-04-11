const BASE = 'https://api.mangadex.org';
const COVER_CDN = 'https://uploads.mangadex.org/covers';
const RATE_LIMIT_MS = 400;

let lastRequest = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const wait = Math.max(0, RATE_LIMIT_MS - (now - lastRequest));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();
  return fetch(url);
}

// --- Types ---

export interface MangaDexManga {
  id: string;
  title: string;
  altTitles: string[];
  description: string;
  status: string; // 'ongoing' | 'completed' | 'hiatus' | 'cancelled'
  year: number | null;
  coverUrl: string | null;
  tags: string[];
  contentRating: string; // 'safe' | 'suggestive' | 'erotica' | 'pornographic'
}

export interface MangaDexChapter {
  id: string;
  chapter: string | null; // "1", "2.5", null for oneshots
  volume: string | null;
  title: string | null;
  pages: number;
  scanlationGroup: string | null;
  publishedAt: string;
}

export interface ChapterAggregate {
  volumes: Record<string, {
    volume: string;
    chapters: Record<string, { chapter: string; id: string; count: number }>;
  }>;
}

// --- Search ---

export async function searchManga(query: string, offset = 0, limit = 20): Promise<{
  results: MangaDexManga[];
  total: number;
}> {
  const params = new URLSearchParams({
    title: query,
    limit: String(limit),
    offset: String(offset),
    'includes[]': 'cover_art',
    'order[relevance]': 'desc',
  });

  const res = await rateLimitedFetch(`${BASE}/manga?${params}`);
  if (!res.ok) throw new Error(`MangaDex search failed: ${res.status}`);

  const json = await res.json();

  const results: MangaDexManga[] = json.data.map((manga: any) => {
    // Extract title (prefer English)
    const titleObj = manga.attributes.title;
    const title = titleObj.en || titleObj['ja-ro'] || titleObj.ja || Object.values(titleObj)[0] || 'Untitled';

    // Extract alt titles
    const altTitles = (manga.attributes.altTitles || [])
      .flatMap((t: any) => Object.values(t))
      .filter((t: any) => typeof t === 'string') as string[];

    // Extract description
    const desc = manga.attributes.description?.en || '';

    // Extract cover
    const coverRel = manga.relationships?.find((r: any) => r.type === 'cover_art');
    const coverFilename = coverRel?.attributes?.fileName;
    const coverUrl = coverFilename ? `/api/discover/cover/${manga.id}/${coverFilename}.512.jpg` : null;

    // Extract tags
    const tags = (manga.attributes.tags || [])
      .map((t: any) => t.attributes?.name?.en)
      .filter(Boolean) as string[];

    return {
      id: manga.id,
      title,
      altTitles,
      description: desc,
      status: manga.attributes.status || 'unknown',
      year: manga.attributes.year,
      coverUrl,
      tags,
      contentRating: manga.attributes.contentRating || 'safe',
    };
  });

  return { results, total: json.total };
}

// --- Manga Detail ---

export async function getMangaDetail(id: string): Promise<MangaDexManga | null> {
  const res = await rateLimitedFetch(`${BASE}/manga/${id}?includes[]=cover_art`);
  if (!res.ok) return null;

  const json = await res.json();
  const manga = json.data;

  const titleObj = manga.attributes.title;
  const title = titleObj.en || titleObj['ja-ro'] || titleObj.ja || Object.values(titleObj)[0] || 'Untitled';

  const coverRel = manga.relationships?.find((r: any) => r.type === 'cover_art');
  const coverFilename = coverRel?.attributes?.fileName;
  const coverUrl = coverFilename ? `/api/discover/cover/${manga.id}/${coverFilename}.512.jpg` : null;

  const altTitles = (manga.attributes.altTitles || [])
    .flatMap((t: any) => Object.values(t))
    .filter((t: any) => typeof t === 'string') as string[];

  const tags = (manga.attributes.tags || [])
    .map((t: any) => t.attributes?.name?.en)
    .filter(Boolean) as string[];

  return {
    id: manga.id,
    title,
    altTitles,
    description: manga.attributes.description?.en || '',
    status: manga.attributes.status || 'unknown',
    year: manga.attributes.year,
    coverUrl,
    tags,
    contentRating: manga.attributes.contentRating || 'safe',
  };
}

// --- Chapter List (aggregated) ---

export async function getChapterAggregate(mangaId: string, lang = 'en'): Promise<ChapterAggregate> {
  const res = await rateLimitedFetch(
    `${BASE}/manga/${mangaId}/aggregate?translatedLanguage[]=${lang}`
  );
  if (!res.ok) throw new Error(`Failed to get chapters: ${res.status}`);
  return res.json();
}

// --- Detailed chapter list with metadata ---

export async function getChapterList(mangaId: string, lang = 'en'): Promise<MangaDexChapter[]> {
  const chapters: MangaDexChapter[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const params = new URLSearchParams({
      manga: mangaId,
      'translatedLanguage[]': lang,
      limit: String(limit),
      offset: String(offset),
      'order[chapter]': 'asc',
      'includes[]': 'scanlation_group',
    });

    const res = await rateLimitedFetch(`${BASE}/chapter?${params}`);
    if (!res.ok) break;

    const json = await res.json();

    for (const ch of json.data) {
      // Skip externally hosted chapters (can't download)
      if (ch.attributes.externalUrl) continue;
      if (ch.attributes.pages === 0) continue;

      const group = ch.relationships?.find((r: any) => r.type === 'scanlation_group');

      chapters.push({
        id: ch.id,
        chapter: ch.attributes.chapter,
        volume: ch.attributes.volume,
        title: ch.attributes.title,
        pages: ch.attributes.pages,
        scanlationGroup: group?.attributes?.name || null,
        publishedAt: ch.attributes.publishAt || ch.attributes.createdAt,
      });
    }

    if (json.data.length < limit) break;
    offset += limit;
  }

  return chapters;
}

// --- Page URLs for a chapter ---

export async function getChapterPages(chapterId: string): Promise<{
  baseUrl: string;
  pages: string[];    // full quality filenames
  pagesSaver: string[]; // data-saver filenames
  hash: string;
}> {
  const res = await rateLimitedFetch(`${BASE}/at-home/server/${chapterId}`);
  if (!res.ok) throw new Error(`Failed to get pages: ${res.status}`);

  const json = await res.json();
  return {
    baseUrl: json.baseUrl,
    pages: json.chapter.data,
    pagesSaver: json.chapter.dataSaver,
    hash: json.chapter.hash,
  };
}

// Construct full image URL
export function pageImageUrl(baseUrl: string, hash: string, filename: string, dataSaver = false): string {
  return `${baseUrl}/${dataSaver ? 'data-saver' : 'data'}/${hash}/${filename}`;
}
