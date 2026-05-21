import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronDown, MessageSquare, Pause, Play, Repeat, X } from 'lucide-react';
import type { TranslatedBubble } from '../lib/api';

/**
 * Story mode's reading surface. The user looks at the page art; this panel
 * TELLS the page's story — a flowing narration passage they can read or have
 * read aloud. The original bubbles are demoted to a collapsible "source lines"
 * citation list: tapping one glows that bubble on the page, a "where am I" aid.
 *
 * Layout is placement-agnostic — a header / scrolling narration / citations
 * column that fills whatever box ReaderPage gives it (a side rail on wide
 * screens, a bottom strip on narrow ones).
 */

const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

interface StoryPanelProps {
  /** 0-based index of the page on screen. */
  page: number;
  /** The told-story passage. Empty while loading or when the page isn't narrated. */
  narration: string;
  /** The citation layer — original/English text per bubble, each with a box. */
  bubbles: TranslatedBubble[];
  /** A narration fetch is in flight. */
  loading: boolean;
  /** Tiny dataURL of the page art, used as a blurred ambient backdrop. */
  ambient: string | null;
  /** Bubble whose box is currently glowing on the page (a citation), if any. */
  highlightedOrder: number | null;
  /** Tap a source line — glow that bubble on the page (null clears it). */
  onCiteBubble: (order: number | null) => void;
  /** Leave Story mode. */
  onClose: () => void;
  /**
   * Read-aloud reached the natural end of this page. Returns true if it moved
   * on to a next page — the panel uses that to keep the auto-advance chain
   * going (and auto-start the next page's narration once it loads).
   */
  onRequestNextPage: () => boolean;
}

type PlayState = 'idle' | 'playing' | 'paused';

export default function StoryPanel({
  page, narration, bubbles, loading, ambient,
  highlightedOrder, onCiteBubble, onClose, onRequestNextPage,
}: StoryPanelProps) {
  const [playState, setPlayState] = useState<PlayState>('idle');
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [showCitations, setShowCitations] = useState(false);

  // The model writes a flowing passage; render its newline-separated chunks
  // as paragraphs so a multi-beat page reads with real spacing.
  const paragraphs = useMemo(
    () => narration.split(/\n+/).map((s) => s.trim()).filter(Boolean),
    [narration],
  );
  // Sound effects ("Gyu...", "(shaking)") aren't lines anyone "says" — keep
  // the citation list to the meaningful dialogue/narration/sign text.
  const citationLines = useMemo(
    () => bubbles.filter((b) => b.type !== 'sfx' && (b.english || b.japanese)),
    [bubbles],
  );

  // ----- Read-aloud (Web Speech API) -----
  //
  // One utterance is live at a time. We never rely on the `cancelled` flag
  // pattern: instead we strip a doomed utterance's handlers BEFORE cancelling
  // it, so the only `onend` that ever fires with a live handler is a genuine,
  // natural completion — which is exactly when auto-advance should trigger.
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const autoAdvanceRef = useRef(autoAdvance);
  const armedRef = useRef(false); // next narration should auto-play (chain)
  useEffect(() => { autoAdvanceRef.current = autoAdvance; }, [autoAdvance]);

  const stop = useCallback(() => {
    if (!speechSupported) return;
    const u = utteranceRef.current;
    if (u) { u.onend = null; u.onerror = null; }
    utteranceRef.current = null;
    window.speechSynthesis.cancel();
    setPlayState('idle');
  }, []);

  const speak = useCallback((text: string) => {
    if (!speechSupported || !text) return;
    const prev = utteranceRef.current;
    if (prev) { prev.onend = null; prev.onerror = null; }
    window.speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 1;
    u.onend = () => {
      utteranceRef.current = null;
      setPlayState('idle');
      // Natural end — chain to the next page if auto-advance is on.
      if (autoAdvanceRef.current) armedRef.current = onRequestNextPage();
    };
    u.onerror = () => { utteranceRef.current = null; setPlayState('idle'); };
    utteranceRef.current = u;
    setPlayState('playing');
    window.speechSynthesis.speak(u);
  }, [onRequestNextPage]);

  const togglePlay = useCallback(() => {
    if (playState === 'idle') speak(narration);
    else if (playState === 'playing') { window.speechSynthesis.pause(); setPlayState('paused'); }
    else { window.speechSynthesis.resume(); setPlayState('playing'); }
  }, [playState, narration, speak]);

  // A new page on screen — silence the previous page's narration.
  useEffect(() => { stop(); }, [page, stop]);

  // Auto-advance chain: when the next page's narration arrives, play it.
  useEffect(() => {
    if (armedRef.current && narration) {
      armedRef.current = false;
      speak(narration);
    }
  }, [narration, speak]);

  // Stop speaking when the panel unmounts (Story mode turned off, reader left).
  useEffect(() => stop, [stop]);

  // Chrome silently stalls utterances longer than ~15s; a periodic resume()
  // keeps a long narration paragraph going. Harmless no-op in other browsers,
  // and not run while the user has deliberately paused.
  useEffect(() => {
    if (playState !== 'playing') return;
    const id = setInterval(() => window.speechSynthesis.resume(), 10000);
    return () => clearInterval(id);
  }, [playState]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-gray-950 text-gray-100">
      {/* Ambient backdrop — a blurred wash of the page's own colours. */}
      {ambient && (
        <div
          className="absolute inset-0 scale-125 bg-cover bg-center opacity-50 blur-2xl"
          style={{ backgroundImage: `url(${ambient})` }}
          aria-hidden
        />
      )}
      <div className="absolute inset-0 bg-gray-950/85" aria-hidden />

      <div className="relative flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">
            <BookOpen size={13} />
            <span>Story</span>
            <span className="text-gray-600">·</span>
            <span className="tabular-nums text-gray-300">Page {page + 1}</span>
          </div>
          <button
            onClick={onClose}
            title="Exit Story mode"
            aria-label="Exit Story mode"
            className="rounded p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Read-aloud controls */}
        {speechSupported && (
          <div className="flex items-center gap-2 px-4 pb-2">
            <button
              onClick={togglePlay}
              disabled={!narration}
              className="flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition-opacity disabled:opacity-30"
            >
              {playState === 'playing' ? <Pause size={15} /> : <Play size={15} />}
              {playState === 'playing' ? 'Pause' : playState === 'paused' ? 'Resume' : 'Read aloud'}
            </button>
            <button
              onClick={() => setAutoAdvance((v) => !v)}
              title="Auto-advance to the next page when narration finishes"
              aria-pressed={autoAdvance}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                autoAdvance ? 'bg-accent text-white' : 'bg-white/10 text-gray-300 hover:bg-white/15'
              }`}
            >
              <Repeat size={13} />
              Auto
            </button>
          </div>
        )}

        {/* Narration — the heart of Story mode */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
          {loading ? (
            <p className="pt-6 text-center text-sm text-gray-500">Loading…</p>
          ) : paragraphs.length > 0 ? (
            <div className="space-y-3 text-[15px] leading-7 text-gray-100 sm:text-base">
              {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          ) : (
            <p className="pt-6 text-center text-sm text-gray-500">
              This page hasn’t been narrated yet.
            </p>
          )}
        </div>

        {/* Citations — the demoted bubble layer, a "where am I" aid */}
        {citationLines.length > 0 && (
          <div className="shrink-0 border-t border-white/10">
            <button
              onClick={() => setShowCitations((v) => !v)}
              aria-expanded={showCitations}
              className="flex w-full items-center justify-between px-4 py-2 text-xs font-medium text-gray-400 transition-colors hover:text-gray-200"
            >
              <span className="flex items-center gap-1.5">
                <MessageSquare size={13} />
                Source lines · {citationLines.length}
              </span>
              <ChevronDown size={14} className={`transition-transform ${showCitations ? 'rotate-180' : ''}`} />
            </button>
            {showCitations && (
              <div className="max-h-44 space-y-0.5 overflow-y-auto px-2 pb-2">
                {citationLines.map((b) => {
                  const active = b.order === highlightedOrder;
                  const locatable = !!b.bbox;
                  return (
                    <button
                      key={b.order}
                      onClick={() => locatable && onCiteBubble(active ? null : b.order)}
                      disabled={!locatable}
                      title={locatable ? 'Show this line on the page' : 'No location recorded for this line'}
                      className={`flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-[13px] leading-snug transition-colors ${
                        active
                          ? 'bg-white/15 ring-1 ring-accent'
                          : locatable ? 'hover:bg-white/10' : 'opacity-50'
                      }`}
                    >
                      <span className="mt-0.5 shrink-0 text-[9px] font-semibold uppercase tracking-wide text-gray-500">
                        {b.type}
                      </span>
                      <span className="text-gray-200">{b.english || b.japanese}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
