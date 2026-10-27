export function cleanDescription(raw: string): string {
  let s = raw;
  s = s.replace(/<\s*\/?\s*(p|br|div|li|h[1-6])\b[^>]*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/&nbsp;/gi, ' ');
  s = s.replace(/&amp;/gi, '&');
  s = s.replace(/&lt;/gi, '<');
  s = s.replace(/&gt;/gi, '>');
  s = s.replace(/&quot;/gi, '"');
  s = s.replace(/&apos;/gi, "'");
  s = s.replace(/&mdash;/gi, '—');
  s = s.replace(/&ndash;/gi, '–');
  s = s.replace(/&hellip;/gi, '…');
  s = s.replace(/&lsquo;|&rsquo;/gi, "'");
  s = s.replace(/&ldquo;|&rdquo;/gi, '"');
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
  s = s.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/\n[ \t]+/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}
