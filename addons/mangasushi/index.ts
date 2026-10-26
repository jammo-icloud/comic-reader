/**
 * Manga Sushi connector — WordPress Madara scanlation site.
 * Ported from the Hakuneko MangaSushi connector as a test of the porting guide.
 */
import { createFetch, type MangaSource, type SearchResult, type ChapterResult } from '@bindery/addon-api';

const SITE_URL = 'https://mangasushi.org';

const get = createFetch({ rateLimitMs: 400, referer: `${SITE_URL}/` });

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const res = await get(url, init);
  if (!res.ok) throw new Error(`MangaSushi fetch failed: ${res.status}`);
  return res.text();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export const mangasushiSource: MangaSource = {
  id: 'mangasushi',
  name: 'Manga Sushi',

  async search(query: string, limit = 20): Promise<SearchResult[]> {
    const html = await fetchText(
      `${SITE_URL}/?s=${encodeURIComponent(query)}&post_type=wp-manga`,
    );

    const items: SearchResult[] = [];
    // Split on each Madara search-result row
    const blocks = html.split('c-tabs-item__content');
    for (let i = 1; i < blocks.length && items.length < limit; i++) {
      const block = blocks[i];

      // Title + URL from the post-title link
      const linkMatch = block.match(/class="[^"]*post-title[\s\S]*?<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/);
      if (!linkMatch) continue;
      const [, href, rawTitle] = linkMatch;
      const title = decodeEntities(rawTitle.trim());

      const slugMatch = href.match(/\/manga\/([^/]+)\/?$/);
      if (!slugMatch) continue;
      const slug = slugMatch[1];

      // Cover image — prefer data-src (lazy-loaded) over src (placeholder)
      const dataSrcMatch = block.match(/data-src="([^"]+)"[^>]*class="[^"]*img-responsive/);
      const srcMatch = block.match(/src="([^"]+)"[^>]*class="[^"]*img-responsive/);
      let coverUrl = dataSrcMatch ? dataSrcMatch[1] : srcMatch ? srcMatch[1] : null;
      if (coverUrl?.includes('/themes/madara/images/')) coverUrl = null;

      // Status
      const statusMatch = block.match(/mg_status[\s\S]*?summary-content[^>]*>\s*([^<]+)/);
      const status = statusMatch ? statusMatch[1].trim().toLowerCase() : 'unknown';

      items.push({
        sourceId: 'mangasushi',
        sourceName: 'Manga Sushi',
        mangaId: slug,
        title,
        coverUrl,
        description: '',
        status,
        year: null,
        tags: [],
      });
    }

    return items;
  },

  async getChapters(mangaId: string): Promise<ChapterResult[]> {
    // Madara AJAX chapters endpoint
    const html = await fetchText(
      `${SITE_URL}/manga/${mangaId}/ajax/chapters/`,
      { method: 'POST' },
    );

    const chapters: ChapterResult[] = [];
    const seen = new Set<string>();
    // Chapter links: /manga/{slug}/chapter-{num}/
    const regex = /href="[^"]*\/manga\/[^/]+\/([^/"]+)\/"[^>]*>\s*([^<]+)/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const chapterPath = match[1]; // e.g. "chapter-2-1"
      if (seen.has(chapterPath)) continue;
      seen.add(chapterPath);

      const label = match[2].trim();
      // Extract number from path: "chapter-2-1" → "2.1", "chapter-1" → "1"
      const numMatch = chapterPath.match(/chapter-([\d]+(?:-[\d]+)?)/);
      const chapterNum = numMatch ? numMatch[1].replace('-', '.') : chapterPath;

      chapters.push({
        sourceId: 'mangasushi',
        chapterId: `${mangaId}/${chapterPath}`,
        chapter: chapterNum,
        title: label !== `Chapter ${chapterNum}` ? label : null,
        pages: 0,
        scanlationGroup: null,
      });
    }

    chapters.sort((a, b) => parseFloat(a.chapter || '0') - parseFloat(b.chapter || '0'));
    return chapters;
  },

  async getPageUrls(chapterId: string): Promise<string[]> {
    // chapterId is "{slug}/{chapter-path}"
    const html = await fetchText(`${SITE_URL}/manga/${chapterId}/`);

    // Madara page images: img.wp-manga-chapter-img with data-src (lazy) or src
    // data-src values may contain whitespace/newlines that need trimming
    const pages: string[] = [];
    const regex = /<img[^>]*data-src="([^"]+)"[^>]*class="[^"]*wp-manga-chapter-img/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const url = match[1].replace(/\s+/g, '').trim();
      if (url && !pages.includes(url)) {
        pages.push(url);
      }
    }

    return pages;
  },

  getMangaUrl(mangaId: string) {
    return `${SITE_URL}/manga/${mangaId}/`;
  },
};

export default mangasushiSource;
