import type { MangaSource, SearchResult, ChapterResult } from './types.js';

const SITE_URL = 'https://fanfox.net';
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
      'Cookie': 'isAdult=1',
      'Referer': `${SITE_URL}/`,
    },
  });
  if (!res.ok) throw new Error(`MangaFox fetch failed: ${res.status}`);
  return res.text();
}

export const mangafoxSource: MangaSource = {
  id: 'mangafox',
  name: 'MangaFox',

  async search(query: string, limit = 20): Promise<SearchResult[]> {
    const html = await fetchPage(`${SITE_URL}/search?title=${encodeURIComponent(query)}`);

    // Parse search results from HTML
    const items: SearchResult[] = [];
    const regex = /<p class="manga-list-4-item-title"><a href="([^"]+)"[^>]*title="([^"]+)"/g;
    let match;
    while ((match = regex.exec(html)) !== null && items.length < limit) {
      const [, href, title] = match;
      const slug = href.replace(/^\/manga\//, '').replace(/\/$/, '');

      // Try to find cover image
      const coverRegex = new RegExp(`<img[^>]*class="manga-list-4-cover"[^>]*src="([^"]+)"[^>]*alt="${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'i');
      const coverMatch = coverRegex.exec(html);
      const coverUrl = coverMatch
        ? `/api/discover/proxy-image?url=${encodeURIComponent(coverMatch[1].startsWith('//') ? 'https:' + coverMatch[1] : coverMatch[1])}`
        : null;

      items.push({
        sourceId: 'mangafox',
        sourceName: 'MangaFox',
        mangaId: slug,
        title,
        coverUrl,
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
    const regex = /href="(\/manga\/[^"]*\/c[\d.]+\/[^"]*)"[^>]*>/g;
    const seen = new Set<string>();
    let match;

    while ((match = regex.exec(html)) !== null) {
      const href = match[1];
      // Extract chapter number from URL like /manga/solo_leveling/c001/1.html
      const chMatch = href.match(/\/c([\d.]+)\//);
      if (!chMatch) continue;
      const chNum = chMatch[1];
      if (seen.has(chNum)) continue;
      seen.add(chNum);

      chapters.push({
        sourceId: 'mangafox',
        chapterId: `${mangaSlug}/c${chNum}`,
        chapter: String(parseFloat(chNum)),
        title: null,
        pages: 0,
        scanlationGroup: null,
      });
    }

    // Sort by chapter number
    chapters.sort((a, b) => parseFloat(a.chapter || '0') - parseFloat(b.chapter || '0'));
    return chapters;
  },

  async getPageUrls(chapterId: string): Promise<string[]> {
    // chapterId is like "solo_leveling/c001"
    const chapterUrl = `${SITE_URL}/manga/${chapterId}/1.html`;
    const html = await fetchPage(chapterUrl);

    // Get imagecount and chapterid from the page
    const imagecountMatch = html.match(/imagecount\s*=\s*(\d+)/);
    const chapteridMatch = html.match(/chapterid\s*=\s*(\d+)/);

    if (!imagecountMatch || !chapteridMatch) {
      console.error(`MangaFox: Could not find imagecount/chapterid for ${chapterId}`);
      return [];
    }

    const imagecount = parseInt(imagecountMatch[1], 10);
    const cid = chapteridMatch[1];

    // Check for webtoon mode (newImgs array)
    const newImgsMatch = html.match(/newImgs\s*=\s*\[([^\]]+)\]/);
    if (newImgsMatch) {
      const urls = newImgsMatch[1].match(/"([^"]+)"/g)?.map((s) => s.replace(/"/g, '')) || [];
      return urls.map((u) => u.startsWith('//') ? `https:${u}` : u);
    }

    // Standard mode: fetch each page via chapterfun.ashx
    // Each call returns a packed JS function that defines an array of 2 image URLs
    const pages: string[] = [];
    for (let page = 1; page <= imagecount; page += 2) {
      try {
        const funUrl = `${SITE_URL}/manga/${chapterId}/chapterfun.ashx?cid=${cid}&page=${page}&key=`;
        const jsCode = await fetchPage(funUrl);

        // The response is: eval(function(p,a,c,k,e,d){...packer...}('...packed...',base,count,'...dict...'.split('|'),0,{}))
        // When eval'd, it defines dm5imagefun() which returns an array of URLs, calls it, assigns to d.
        // We need to extract the URL array from the unpacked code.

        // Step 1: Unpack by replacing outer eval with a function call
        const unpacked = eval(jsCode.replace(/^eval/, '')) as string;

        // Step 2: Extract URLs from the unpacked JS string
        // The unpacked code looks like: function dm5imagefun(){var pix="//cdn.../store/manga/...";var pvalue=["/m000.jpg?...","/m001.jpg?..."];...return pvalue}var d;d=dm5imagefun();
        // Extract the pix base path and pvalue array entries
        const pixMatch = unpacked.match(/var pix="([^"]+)"/);
        const pvalueMatch = unpacked.match(/var pvalue=\[([^\]]+)\]/);

        if (pixMatch && pvalueMatch) {
          const basePath = pixMatch[1];
          const entries = pvalueMatch[1].match(/"([^"]+)"/g)?.map((s) => s.replace(/"/g, '')) || [];
          for (const entry of entries) {
            const fullUrl = `https:${basePath}${entry}`;
            if (!pages.includes(fullUrl)) {
              pages.push(fullUrl);
            }
          }
        }
      } catch (err) {
        console.error(`MangaFox page ${page} fetch error:`, (err as Error).message);
      }

      await sleep(100);
    }

    return pages;
  },
};
