const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';

export interface SummaryResult {
  summary: string;
  model: string;
  durationMs: number;
}

/**
 * Call Ollama to generate a summary from the prompt
 */
export async function summarize(prompt: string): Promise<SummaryResult> {
  const start = Date.now();

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: 0.3,     // Low creativity — we want factual summaries
        num_predict: 500,     // Keep summaries concise
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  const json = await res.json();

  return {
    summary: json.response?.trim() || '',
    model: OLLAMA_MODEL,
    durationMs: Date.now() - start,
  };
}

/**
 * Check if Ollama is reachable and the model is available
 */
export async function ollamaHealth(): Promise<{ ok: boolean; model: string; error?: string }> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) return { ok: false, model: OLLAMA_MODEL, error: `Ollama returned ${res.status}` };

    const json = await res.json();
    const models = json.models?.map((m: any) => m.name) || [];
    const hasModel = models.some((m: string) => m.startsWith(OLLAMA_MODEL.split(':')[0]));

    return {
      ok: true,
      model: OLLAMA_MODEL,
      error: hasModel ? undefined : `Model "${OLLAMA_MODEL}" not found. Run: docker exec ollama ollama pull ${OLLAMA_MODEL}`,
    };
  } catch (err) {
    return { ok: false, model: OLLAMA_MODEL, error: `Cannot reach Ollama at ${OLLAMA_URL}: ${(err as Error).message}` };
  }
}
