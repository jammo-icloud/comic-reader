import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { BookOpen, Crosshair, Pause, Repeat, Sparkles, Volume2, X } from 'lucide-react';
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
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0e0d0c',
        color: '#fff',
        overflow: 'hidden',
      }}
    >
      {/* Ambient blurred backdrop — the current page's own colours wash
          behind the narration. */}
      {ambient && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${ambient})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(40px) brightness(0.4) saturate(1.2)',
            opacity: 0.5,
            transform: 'scale(1.2)',
          }}
        />
      )}

      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        {/* Header — book-open icon + page meta + read-aloud + auto-advance + close */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 16px',
            borderBottom: '1px solid rgb(255 255 255 / 0.08)',
          }}
        >
          <span style={{ display: 'inline-flex', color: 'rgb(var(--accent))' }}>
            <BookOpen size={16} />
          </span>
          <span
            className="bindery-nums"
            style={{ fontSize: 13, fontWeight: 600, flex: 1 }}
          >
            Story · Page {page + 1}
          </span>
          {speechSupported && (
            <>
              <button
                onClick={() => setAutoAdvance((v) => !v)}
                aria-pressed={autoAdvance}
                title="Auto-advance to the next page when narration finishes"
                style={{
                  ...storyIconBtn,
                  background: autoAdvance
                    ? 'rgb(var(--accent) / 0.3)'
                    : storyIconBtn.background,
                  color: autoAdvance ? 'rgb(var(--accent))' : storyIconBtn.color,
                }}
              >
                <Repeat size={14} />
              </button>
              <button
                onClick={togglePlay}
                disabled={!narration}
                title={
                  playState === 'playing' ? 'Pause' :
                  playState === 'paused' ? 'Resume' : 'Read aloud'
                }
                aria-label={playState === 'playing' ? 'Pause' : 'Read aloud'}
                style={{
                  ...storyIconBtn,
                  background: playState === 'playing'
                    ? 'rgb(var(--accent))'
                    : storyIconBtn.background,
                  opacity: narration ? 1 : 0.4,
                }}
              >
                {playState === 'playing' ? <Pause size={14} /> : <Volume2 size={14} />}
              </button>
            </>
          )}
          <button
            onClick={onClose}
            title="Exit Story mode"
            aria-label="Exit Story mode"
            style={storyIconBtn}
          >
            <X size={14} />
          </button>
        </div>

        {/* Scrolling body — serif narration + numbered bubble chips */}
        <div
          className="no-scrollbar"
          style={{ flex: 1, overflowY: 'auto', padding: 16 }}
        >
          {loading ? (
            <p
              style={{
                paddingTop: 24,
                textAlign: 'center',
                fontSize: 13,
                color: 'rgb(255 255 255 / 0.4)',
              }}
            >
              Loading…
            </p>
          ) : paragraphs.length > 0 ? (
            paragraphs.map((p, i) => (
              <p
                key={i}
                style={{
                  fontSize: 15,
                  lineHeight: 1.7,
                  color: 'rgb(255 255 255 / 0.92)',
                  margin: '0 0 16px',
                  fontFamily: 'var(--font-serif, Georgia, serif)',
                }}
              >
                {p}
              </p>
            ))
          ) : (
            <p
              style={{
                paddingTop: 24,
                textAlign: 'center',
                fontSize: 13,
                color: 'rgb(255 255 255 / 0.4)',
              }}
            >
              This page hasn’t been narrated yet.
            </p>
          )}

          {citationLines.length > 0 && (
            <>
              <div
                className="by-kicker"
                style={{ color: 'rgb(255 255 255 / 0.45)', marginTop: 12, marginBottom: 10 }}
              >
                Bubbles on this page
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {citationLines.map((b, i) => {
                  const active = b.order === highlightedOrder;
                  const locatable = !!b.bbox;
                  return (
                    <button
                      key={b.order}
                      onClick={() => locatable && onCiteBubble(active ? null : b.order)}
                      disabled={!locatable}
                      title={locatable ? 'Show this line on the page' : 'No location recorded for this line'}
                      style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-start',
                        textAlign: 'left',
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: active
                          ? '1px solid rgb(var(--accent))'
                          : '1px solid rgb(255 255 255 / 0.1)',
                        background: active
                          ? 'rgb(var(--accent) / 0.12)'
                          : 'rgb(255 255 255 / 0.04)',
                        color: '#fff',
                        cursor: locatable ? 'pointer' : 'not-allowed',
                        opacity: locatable ? 1 : 0.5,
                      }}
                    >
                      <span
                        className="bindery-nums"
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: 'rgb(var(--accent))',
                          marginTop: 2,
                          minWidth: 12,
                        }}
                      >
                        {i + 1}
                      </span>
                      <span style={{ flex: 1, fontSize: 13, lineHeight: 1.5, opacity: 0.85 }}>
                        {b.english || b.japanese}
                      </span>
                      {locatable && (
                        <span style={{ display: 'inline-flex', opacity: 0.4, flexShrink: 0 }}>
                          <Crosshair size={14} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer — gentle AI hint */}
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid rgb(255 255 255 / 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
            opacity: 0.5,
          }}
        >
          <Sparkles size={13} />
          AI narration · tap a bubble to find it on the page
        </div>
      </div>
    </div>
  );
}

const storyIconBtn: CSSProperties = {
  background: 'rgb(255 255 255 / 0.08)',
  border: 'none',
  color: '#fff',
  cursor: 'pointer',
  width: 30,
  height: 30,
  borderRadius: 8,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
