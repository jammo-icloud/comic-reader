/* Bindery UI kit — Login (comic-panel spread). */

const { Button, Input } = window.DS;

function Login({ onSignIn }) {
  const [u, setU] = React.useState('');
  const [p, setP] = React.useState('');
  return (
    <div style={{
      height: '100dvh', width: '100%', background: '#0a0a0a', display: 'flex', flexDirection: 'column',
      padding: 20, overflow: 'hidden',
      backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.045 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
    }}>
      {/* Comic title */}
      <div style={{ maxWidth: 1024, margin: '0 auto', width: '100%', display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 44, fontWeight: 900, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1,
          textShadow: '2px 2px 0 #000, 3px 3px 0 #000, 5px 5px 0 rgb(var(--accent))' }}>BINDERY</h1>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#71717a' }}>// your library</span>
      </div>

      {/* Spread */}
      <div style={{ flex: 1, minHeight: 0, maxWidth: 1024, margin: '12px auto 0', width: '100%',
        display: 'grid', gap: 14, gridTemplateColumns: '1.6fr 1fr 1fr', gridTemplateRows: '1fr 1fr',
        gridTemplateAreas: '"hero hero login" "p2 p3 p3"' }}>
        <Panel src={window.ART.forest} rot={-1.2} area="hero" />
        <Panel src={window.ART.bg2} rot={1.5} area="p2" />
        <Panel src={window.ART.bg3} rot={-0.6} area="p3" />

        {/* Login panel */}
        <div style={{ gridArea: 'login', alignSelf: 'start', position: 'relative', zIndex: 30,
          background: '#fff', border: '6px solid #000', overflow: 'hidden',
          boxShadow: '0 18px 44px rgb(0 0 0 / 0.7)', outline: '3px solid rgb(var(--accent)/0.5)',
          transform: 'perspective(1800px) rotateY(-4deg) rotate(0.6deg) scale(1.02)' }}>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.10) 1px, transparent 1px)', backgroundSize: '6px 6px', opacity: 0.5 }} />
          <div style={{ position: 'relative', background: '#000', color: '#fff', padding: '14px 20px', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 0.25, backgroundImage: 'radial-gradient(circle, white 1.2px, transparent 1.2px)', backgroundSize: '7px 7px' }} />
            <h2 style={{ position: 'relative', margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-0.01em', textShadow: '2px 2px 0 rgb(var(--accent)/0.9), 3px 3px 0 rgba(0,0,0,0.4)' }}>SIGN&nbsp;IN</h2>
            <p style={{ position: 'relative', margin: '4px 0 0', fontSize: 10, fontFamily: 'var(--font-mono)', color: '#a1a1aa' }}>to your library</p>
          </div>
          <form onSubmit={e => { e.preventDefault(); onSignIn(); }} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12, padding: 20 }}>
            <CLabel>USERNAME</CLabel>
            <Input variant="comic" value={u} onChange={e => setU(e.target.value)} placeholder="your username" />
            <CLabel>PASSWORD</CLabel>
            <Input variant="comic" type="password" value={p} onChange={e => setP(e.target.value)} placeholder="••••••••" />
            <div style={{ paddingTop: 6 }}>
              <Button variant="comic" type="submit" style={{ width: '100%', padding: '12px 0' }}>Sign In →</Button>
            </div>
          </form>
        </div>
      </div>

      <div style={{ maxWidth: 1024, margin: '8px auto 0', width: '100%', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#52525b' }}>
        <span style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>· shinkai</span>
        <span>NAS Auth · v4.2.0</span>
      </div>
    </div>
  );
}

function Panel({ src, rot, area }) {
  return (
    <div style={{ gridArea: area, position: 'relative', background: '#000', border: '6px solid #000',
      boxShadow: '0 8px 24px rgb(0 0 0 / 0.6)', overflow: 'hidden', transform: `rotate(${rot}deg)` }}>
      <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
}
function CLabel({ children }) {
  return <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#3f3f46', marginBottom: -6 }}>{children}</span>;
}

Object.assign(window, { Login });
