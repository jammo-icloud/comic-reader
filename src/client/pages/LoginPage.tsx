import { useState, useRef, useEffect } from 'react';
import { Loader, AlertCircle, ShieldCheck } from 'lucide-react';

/**
 * Login page — comic-panel spread.
 *
 * The page reads as a single comic page: a large hero panel (top-left), two
 * smaller establishing-shot panels (bottom-left), a "manga panel" accent
 * floating across the gutter, and the login form rendered AS a comic panel
 * on the right. On every page load the server picks a random aesthetic
 * (shinkai / brutalist-scifi / cyberpunk-neon / etc.) and 3 panels from it,
 * plus 1 universal manga-panel accent. Refresh = new spread.
 *
 * Design notes:
 * - Panels have thick black borders, slight rotation, drop shadow → physical paper
 * - Title is comic-style: multi-layer text-shadow for the stacked-plate effect
 * - prefers-reduced-motion disables panel rotation (keeps borders + shadows)
 * - Mobile collapses to a stacked layout — hero on top, panels in a row, login below
 * - Accent panel is positioned absolutely so it overlaps the gutter between
 *   panels like a sticker on a comic page
 */

interface LoginSpread {
  aesthetic: string;
  panels: string[];   // 3 establishing-shot URLs
  accents: string[];  // 0-1 manga-panel accent URLs
}

function useVersion() {
  const [version, setVersion] = useState('');
  useEffect(() => {
    fetch('/api/auth/version').then((r) => r.json()).then((d) => setVersion(d.version)).catch(() => {});
  }, []);
  return version;
}

function useLoginSpread(): LoginSpread | null {
  const [spread, setSpread] = useState<LoginSpread | null>(null);
  useEffect(() => {
    fetch('/api/auth/login-bg/spread')
      .then((r) => r.ok ? r.json() : null)
      .then((d: LoginSpread | null) => { if (d) setSpread(d); })
      .catch(() => {});
  }, []);
  return spread;
}

export default function LoginPage() {
  const version = useVersion();
  const spread = useLoginSpread();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpRequired, setOtpRequired] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (otpRequired) otpRef.current?.focus();
  }, [otpRequired]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    if (otpRequired && !otpCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
          ...(otpRequired ? { otpCode: otpCode.trim() } : {}),
        }),
      });
      const data = await res.json();

      if (data.otpRequired) { setOtpRequired(true); return; }
      if (!res.ok || !data.ok) {
        setError(data.error || 'Invalid credentials');
        if (otpRequired) setOtpCode('');
        return;
      }
      window.location.href = '/';
    } catch {
      setError('Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  const hero = spread?.panels[0];
  const p2 = spread?.panels[1];
  const p3 = spread?.panels[2];
  const accent = spread?.accents?.[0];

  return (
    <div
      // Fit-to-screen: outer is a flex column owning the full viewport. Title
      // and footer get their natural height; the spread takes everything in
      // between via flex-1. Result: no scroll on any reasonable screen,
      // panels scale up to fill the space — art reads bigger and more
      // dramatic instead of floating in a pocket of viewport.
      className="h-[100dvh] w-full bg-gray-950 relative overflow-hidden flex flex-col p-3 sm:p-4 md:p-6"
      style={{
        // Subtle paper-grain via SVG noise — sells the "physical comic page" read
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.045 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        // 3D perspective on the page — child transforms (the elevated login
        // panel) read with depth instead of skewing flat.
        perspective: '1800px',
      }}
    >
      {/* Comic title strip — across the top */}
      <ComicTitle />

      {/* Spread container — flex-1 so it fills the available viewport.
          Grid template areas drive the layout for both mobile and desktop. */}
      <div
        className="
          login-spread
          flex-1 min-h-0 mx-auto w-full max-w-6xl mt-2 sm:mt-3
          grid gap-2 sm:gap-3 md:gap-4 relative
        "
        style={{
          // Mobile (default): hero across top (2 cols), p2+p3 share the next row,
          // login full-width below. Auto rows so login takes only the form's height
          // and the art panels split the remaining space.
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gridTemplateRows: '2fr 1fr auto',
          gridTemplateAreas: `"hero hero" "p2 p3" "login login"`,
        }}
      >
        {/* Apply md: overrides via inline-conditional className. This is set
            below per-element with grid-area names so Tailwind doesn't have to
            handle dynamic grid-template-areas (it can't). */}
        <style>{`
          /* Desktop: login is a square-ish panel in the top-right (sized to
             the form's natural height — no more wasted vertical column).
             p3 spans 2 cols at the bottom, sweeping under where login sat.
             Hero stays the dominant 2-col panel. p2 is the small bottom-left. */
          @media (min-width: 768px) {
            .login-spread {
              grid-template-columns: 1.6fr 1fr 1fr !important;
              grid-template-rows: 1fr 1fr !important;
              grid-template-areas:
                "hero hero login"
                "p2 p3 p3" !important;
            }
          }
          /* Mobile: skip the 3D tilt — the rotateY would clip the panel edge
             when it spans the viewport width. Keeps a small flat rotation +
             the elevated shadow + accent ring. */
          @media (max-width: 767px) {
            .login-panel-elevated {
              transform: rotate(0.4deg) !important;
            }
          }
          /* Reduced-motion users: strip the 3D perspective on the login panel
             at any width. Shadow + ring keep it visually elevated. */
          @media (prefers-reduced-motion: reduce) {
            .login-panel-elevated {
              transform: rotate(0.4deg) !important;
            }
          }
        `}</style>

        {/* HERO — top, spans hero area */}
        <Panel
          src={hero}
          alt={`${spread?.aesthetic || 'login'} background`}
          rotation={-1.2}
          gridArea="hero"
        />

        {/* LOGIN PANEL — right column on desktop, full-width below on mobile.
            Elevated: 3D perspective tilt + accent-tinted outer ring + larger
            shadow. Reads as the focal point of the page. */}
        <LoginPanel
          username={username}
          password={password}
          otpCode={otpCode}
          otpRequired={otpRequired}
          error={error}
          loading={loading}
          onUsername={setUsername}
          onPassword={setPassword}
          onOtpCode={setOtpCode}
          onSubmit={handleSubmit}
          onCancelOtp={() => { setOtpRequired(false); setOtpCode(''); setError(''); }}
          otpRef={otpRef}
          gridArea="login"
        />

        {/* PANEL 2 — bottom-left */}
        <Panel src={p2} alt="" rotation={1.5} gridArea="p2" />

        {/* PANEL 3 — bottom-middle */}
        <Panel src={p3} alt="" rotation={-0.6} gridArea="p3" />

        {/* ACCENT — floating sticker panel. Hidden on mobile to keep the
            limited screen space readable; on desktop it overlaps the gutter
            where hero meets the bottom row, like a comic-page callout. */}
        {accent && (
          <div
            className="
              hidden md:block absolute z-20
              w-[14%] aspect-square
              border-[5px] border-black bg-black
              shadow-[0_12px_32px_rgba(0,0,0,0.7)]
              motion-safe:rotate-[6deg]
              motion-safe:transition-transform
              hover:scale-105 hover:rotate-[8deg]
            "
            style={{
              // Land between hero and the lower row, tucked to the left of login
              left: '40%',
              top: '54%',
            }}
          >
            <img
              src={accent}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
        )}
      </div>

      {/* Footer: aesthetic credit + version */}
      <div className="relative max-w-6xl mx-auto w-full mt-1 sm:mt-2 flex items-center justify-between text-[10px] text-gray-500 shrink-0">
        <span className="font-mono uppercase tracking-wider">
          {spread?.aesthetic ? `· ${spread.aesthetic}` : ''}
        </span>
        <span>NAS Auth{version && ` · v${version}`}</span>
      </div>
    </div>
  );
}

// ============================================================
// Subcomponents
// ============================================================

/**
 * Single comic panel — thick black border, drop shadow, slight rotation.
 * `rotation` is degrees; accepted small values like ±1 to ±3 read best.
 * Reduced-motion users get the panels flat (border + shadow stay).
 */
function Panel({
  src, alt, rotation, gridArea,
}: {
  src: string | undefined;
  alt: string;
  rotation: number;
  gridArea?: string;
}) {
  return (
    <div
      className="
        relative bg-black border-[5px] sm:border-[6px] border-black
        shadow-[0_8px_24px_rgba(0,0,0,0.6),0_2px_4px_rgba(0,0,0,0.4)]
        overflow-hidden
        motion-safe:transition-transform
      "
      style={{
        gridArea,
        // Reduced-motion users get a flat panel; everyone else gets a slight
        // tilt baked into the panel itself.
        transform: `rotate(${rotation}deg)`,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          loading="eager"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-800 animate-pulse" />
      )}
    </div>
  );
}

/**
 * Login form rendered as a comic panel — same border/shadow/rotation grammar
 * as the art panels, but with form contents instead of an image.
 */
function LoginPanel(props: {
  username: string;
  password: string;
  otpCode: string;
  otpRequired: boolean;
  error: string;
  loading: boolean;
  onUsername: (v: string) => void;
  onPassword: (v: string) => void;
  onOtpCode: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancelOtp: () => void;
  otpRef: React.RefObject<HTMLInputElement | null>;
  gridArea?: string;
}) {
  const {
    username, password, otpCode, otpRequired, error, loading,
    onUsername, onPassword, onOtpCode, onSubmit, onCancelOtp, otpRef, gridArea,
  } = props;
  return (
    <div
      // Elevated focal-point treatment:
      //  - 3D perspective tilt rotates the panel off-axis so it reads as raised
      //  - Accent ring + heavy shadow reinforce the lift
      //  - Body has a subtle halftone pattern overlay for comic-paper texture
      //  - Header is a solid black bar with comic-title type and tighter halftone
      //    (this is the main "treatment" pass — turns a generic form into a
      //    panel that visually belongs in the comic spread)
      className="
        login-panel-elevated
        relative z-20
        bg-white
        border-[5px] sm:border-[6px] border-black
        shadow-[0_18px_44px_rgba(0,0,0,0.7),0_4px_10px_rgba(0,0,0,0.5)]
        overflow-hidden
        ring-[3px] ring-accent/50 ring-offset-0
        motion-safe:transition-transform
      "
      style={{
        gridArea,
        transformOrigin: 'center center',
        transform: 'perspective(1800px) rotateY(-4deg) rotateX(0.5deg) rotate(0.6deg) scale(1.02)',
      }}
    >
      {/* Halftone dot pattern overlay across the entire panel — sells the
          "comic page printed on paper" feel without competing with form text. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(0,0,0,0.10) 1px, transparent 1px)',
          backgroundSize: '6px 6px',
          opacity: 0.5,
        }}
      />

      <div className="relative h-full flex flex-col">
        {/* Comic-style title bar — solid black with white type, halftone dots
            at higher contrast inside the bar. Reads as a panel header / cover
            stripe rather than a generic card-header. */}
        <div className="relative bg-black text-white px-5 sm:px-6 py-3 sm:py-4 overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none opacity-25"
            style={{
              backgroundImage:
                'radial-gradient(circle, white 1.2px, transparent 1.2px)',
              backgroundSize: '7px 7px',
            }}
          />
          <div className="relative flex items-baseline gap-2.5">
            <h2
              className="text-xl sm:text-2xl font-black leading-none tracking-tight"
              style={{
                textShadow:
                  '2px 2px 0 rgb(var(--accent) / 0.9), 3px 3px 0 rgba(0,0,0,0.4)',
              }}
            >
              SIGN&nbsp;IN
            </h2>
            <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-gray-400">
              · access
            </span>
          </div>
          <p className="relative text-[10px] text-gray-400 font-mono mt-1">
            to your library
          </p>
        </div>

        {/* Form area */}
        <form
          onSubmit={onSubmit}
          className="relative flex-1 flex flex-col gap-3 p-5 sm:p-6"
        >
          <FieldLabel>USERNAME</FieldLabel>
          <input
            type="text"
            value={username}
            onChange={(e) => onUsername(e.target.value)}
            placeholder="your username"
            autoFocus={!otpRequired}
            autoComplete="username"
            disabled={otpRequired}
            className="w-full px-3 py-2 text-sm bg-white border-[3px] border-black rounded-none text-black placeholder-gray-400 focus:outline-none focus:border-accent transition-colors font-mono disabled:opacity-50"
          />

          <FieldLabel className="mt-1">PASSWORD</FieldLabel>
          <input
            type="password"
            value={password}
            onChange={(e) => onPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            disabled={otpRequired}
            className="w-full px-3 py-2 text-sm bg-white border-[3px] border-black rounded-none text-black placeholder-gray-400 focus:outline-none focus:border-accent transition-colors font-mono disabled:opacity-50"
          />

          {otpRequired && (
            <>
              <div className="flex items-center gap-2 mt-1">
                <ShieldCheck size={14} className="text-accent" />
                <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent">
                  TWO-FACTOR
                </span>
              </div>
              <input
                ref={otpRef}
                type="text"
                inputMode="numeric"
                value={otpCode}
                onChange={(e) => onOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoComplete="one-time-code"
                className="w-full px-3 py-2 text-sm bg-white border-[3px] border-accent rounded-none text-black placeholder-gray-300 focus:outline-none transition-colors text-center text-xl tracking-[0.4em] font-mono"
              />
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 text-danger text-xs bg-danger/10 border-2 border-danger px-2.5 py-2 mt-1">
              <AlertCircle size={14} className="shrink-0" />
              <span className="font-mono">{error}</span>
            </div>
          )}

          <div className="mt-auto flex flex-col gap-2 pt-3">
            <button
              type="submit"
              disabled={loading || !username.trim() || !password.trim() || (otpRequired && !otpCode.trim())}
              className="
                w-full py-3 text-sm font-black uppercase tracking-wider
                bg-accent text-white rounded-none
                disabled:opacity-40 transition-all
                flex items-center justify-center gap-2
                border-[3px] border-black
                shadow-[3px_3px_0_rgba(0,0,0,1)]
                hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_rgba(0,0,0,1)]
                active:translate-x-[3px] active:translate-y-[3px] active:shadow-none
              "
            >
              {loading ? <Loader size={16} className="animate-spin" /> : null}
              {loading ? 'Signing in…' : otpRequired ? 'Verify →' : 'Sign In →'}
            </button>
            {otpRequired && (
              <button
                type="button"
                onClick={onCancelOtp}
                className="w-full text-[11px] text-gray-500 hover:text-gray-800 transition-colors font-mono uppercase tracking-wider"
              >
                ← back
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Field label in comic-form style — small, monospace, uppercase, tracked.
 * Looks like the label printed above an actual fill-in form field.
 */
function FieldLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`text-[10px] font-mono uppercase tracking-[0.2em] text-gray-700 -mb-2 ${className}`}>
      {children}
    </span>
  );
}

/**
 * Comic-style title strip across the top of the page. Multi-layer text-shadow
 * gives the stacked-plate offset look characteristic of comic title type.
 */
function ComicTitle() {
  return (
    <div className="relative max-w-6xl mx-auto pt-1 sm:pt-2 flex items-baseline gap-3 select-none">
      <h1
        className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-none"
        style={{
          // Stacked-plate offset: black backplane + accent drop = comic title feel.
          // accent uses a hardcoded fallback in case --accent isn't tinted yet at first paint.
          textShadow:
            '2px 2px 0 #000, 3px 3px 0 #000, 5px 5px 0 rgb(var(--accent, 99 102 241))',
          fontFamily: '"Inter", system-ui, sans-serif',
          letterSpacing: '-0.02em',
        }}
      >
        BINDERY
      </h1>
      <span className="hidden sm:inline text-xs text-gray-500 font-mono uppercase tracking-widest pb-1">
        // your library
      </span>
    </div>
  );
}
