/**
 * Internet Archive connector.
 *
 * Archive.org items work differently from scraped sources:
 * - One item = one series (e.g., "manga_No_Game_No_Life")
 * - Each file inside an item = one volume/chapter
 * - Items have multiple variants per volume (EPUB, PDF, fan vs official translations)
 *
 * We group files by volume number and pick a canonical file per volume.
 *
 * Download path: pageUrls returns a single URL to the file. The downloader
 * short-circuits its normal image-stitching flow and downloads the file directly.
 */
import { createFetch, type MangaSource, type SearchResult, type ChapterResult } from '@bindery/addon-api';
import { pickCanonicalFiles, type ArchiveFile } from './files.js';

const API = 'https://archive.org';

const get = createFetch({ rateLimitMs: 300, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });

async function fetchJson(url: string): Promise<any> {
  const res = await get(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Archive.org fetch failed: ${res.status}`);
  return res.json();
}

// --- Source interface ---

export const archiveorgSource: MangaSource = {
  id: 'archiveorg',
  name: 'Internet Archive',

  async search(query: string, limit = 20): Promise<SearchResult[]> {
    // Constrain to manga/comic collections and subjects so unrelated items
    // (books, magazines, audio, etc.) don't pollute the results.
    // Use relevance boosting: title > quoted phrase > any field.
    const phrase = query.trim().replace(/"/g, '');
    const scopeFilter = [
      'collection:comics',
      'collection:manga_library',
      'collection:manga_novels',
      'collection:manga_japanese',
      'collection:manga_chinese',
      'collection:manga_korean',
      'subject:manga',
      'subject:comics',
      'subject:doujinshi',
      'subject:comic',
    ].join(' OR ');
    const q = `(title:"${phrase}"^5 OR "${phrase}"^3 OR (${phrase})) AND mediatype:texts AND (${scopeFilter})`;
    const url = `${API}/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=date&fl[]=description&fl[]=language&sort[]=downloads+desc&rows=${limit}&output=json`;

    let data;
    try {
      data = await fetchJson(url);
    } catch (err) {
      console.error(`Archive.org search failed: ${(err as Error).message}`);
      return [];
    }

    const docs = data?.response?.docs || [];
    return docs.map((d: any) => {
      const desc = Array.isArray(d.description) ? d.description[0] : d.description;
      const year = d.date ? parseInt(String(d.date).slice(0, 4), 10) : null;
      // Language is sometimes a string, sometimes an array
      const langRaw = Array.isArray(d.language) ? d.language : d.language ? [d.language] : [];
      const langs = langRaw.map((l: string) => String(l).toLowerCase());
      const tags: string[] = [];
      if (langs.some((l: string) => /^jpn|japanese$/.test(l))) tags.push('japanese');
      if (langs.some((l: string) => /^kor|korean$/.test(l))) tags.push('korean');
      if (langs.some((l: string) => /^eng|english$/.test(l))) tags.push('english');
      return {
        sourceId: 'archiveorg',
        sourceName: 'Internet Archive',
        mangaId: d.identifier,
        title: d.title || d.identifier,
        coverUrl: `${API}/services/img/${d.identifier}`,
        description: typeof desc === 'string' ? desc.replace(/<[^>]+>/g, '').slice(0, 400) : '',
        status: 'completed',
        year: year && year >= 1900 && year <= 2100 ? year : null,
        tags,
      };
    });
  },

  async getChapters(identifier: string): Promise<ChapterResult[]> {
    let meta;
    try {
      meta = await fetchJson(`${API}/metadata/${identifier}`);
    } catch (err) {
      console.error(`Archive.org metadata failed: ${(err as Error).message}`);
      return [];
    }

    const files: ArchiveFile[] = meta?.files || [];
    const picks = pickCanonicalFiles(files);

    return picks.map((p) => ({
      sourceId: 'archiveorg',
      chapterId: `${identifier}|${p.name}`, // identifier and filename separated by pipe
      chapter: String(p.volume),
      title: p.name.replace(/\.[^.]+$/, ''), // strip extension
      pages: 0,
      scanlationGroup: null,
    }));
  },

  async getPageUrls(chapterId: string): Promise<string[]> {
    // chapterId is "identifier|filename"
    const pipe = chapterId.indexOf('|');
    if (pipe < 0) return [];
    const identifier = chapterId.slice(0, pipe);
    const filename = chapterId.slice(pipe + 1);

    // Return a single URL to the file — downloader short-circuits for PDF/CBR/CBZ
    return [`${API}/download/${identifier}/${encodeURIComponent(filename)}`];
  },

  getMangaUrl(mangaId: string) {
    return `https://archive.org/details/${mangaId}`;
  },
};

export default archiveorgSource;
