export type Genre = 'manga' | 'magazine' | 'comic' | 'general';

const PROMPTS: Record<Genre, string> = {
  manga: `You are summarizing a manga chapter. The text below was extracted via OCR from comic panels — speech bubbles, narration boxes, and sound effects. It may be fragmentary, out of order, or contain OCR errors.

Do your best to reconstruct the narrative. Write a 2-3 sentence summary focusing on:
- Key plot events that happen in this chapter
- Character actions and dialogue
- Any cliffhangers or emotional beats

Text from OCR:`,

  magazine: `You are summarizing an issue of a sci-fi/fantasy anthology magazine (like Heavy Metal Magazine). The text was OCR'd from scanned pages from the 1970s-1990s and may contain errors.

Identify and briefly describe each story or article in this issue. Format as:
- **Story/Article Title** (if identifiable): 1-sentence summary

End with a sentence about the overall theme or mood of the issue.

Text from OCR:`,

  comic: `You are summarizing a single comic book issue. The text below was extracted via OCR from speech bubbles, captions, and narration boxes. It may be incomplete or out of order.

Write a 3-4 sentence plot summary. Include:
- The main conflict or challenge
- Key characters involved
- How the issue ends (or if it's a cliffhanger)

Text from OCR:`,

  general: `You are summarizing a PDF document. The text below was extracted via OCR and may contain errors or formatting artifacts.

Provide a concise summary of the content in 2-3 sentences. Focus on the main topic, key points, and any conclusions.

Text from OCR:`,
};

export function getPrompt(genre: Genre, ocrText: string): string {
  const template = PROMPTS[genre] || PROMPTS.general;
  // Truncate text to ~4000 chars to stay within context window of small models
  const truncated = ocrText.length > 4000
    ? ocrText.substring(0, 4000) + '\n\n[...text truncated for length]'
    : ocrText;
  return `${template}\n\n${truncated}`;
}

export function getGenres(): Genre[] {
  return Object.keys(PROMPTS) as Genre[];
}
