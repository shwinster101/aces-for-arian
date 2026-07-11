import { Component } from 'react';

// Last line of defense: a render exception anywhere below this boundary shows a
// recoverable card instead of a blank/black screen. Inline styles only, so it
// renders even if Tailwind/CSS never loaded. The "reset" escape hatch clears
// this device's local app state (a4a-* keys) — the roster reloads from the
// sheet; only an unsynced local bracket is lost. Used on BOTH entry points.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] render crash:', error, info);
  }

  reset() {
    try {
      Object.keys(localStorage).filter((k) => k.startsWith('a4a-')).forEach((k) => localStorage.removeItem(k));
    } catch { /* private mode — nothing to clear */ }
    location.reload();
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const detail = String((error && (error.stack || error.message)) || error);
    const btn = { fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', border: '1px solid' };
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e4e4e7', padding: 24, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ maxWidth: 680, margin: '8vh auto 0', background: '#151515', border: '1px solid #3f3f46', borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fbbf24' }}>Something went wrong</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: '8px 0 12px' }}>The page hit an error and stopped rendering</h1>
          <p style={{ fontSize: 14, color: '#a1a1aa', lineHeight: 1.6, margin: 0 }}>
            Your data on the Google Sheet is safe. Try <strong style={{ color: '#e4e4e7' }}>Reload</strong> first. If it keeps crashing, <strong style={{ color: '#e4e4e7' }}>reset this device</strong> — the roster reloads from the sheet; only a locally-generated bracket that was never synced is cleared.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            <button onClick={() => location.reload()} style={{ ...btn, background: '#fbbf24', color: '#000', borderColor: '#fbbf24' }}>Reload page</button>
            <button onClick={() => this.reset()} style={{ ...btn, background: 'transparent', color: '#e4e4e7', borderColor: '#3f3f46' }}>Reset this device &amp; reload</button>
          </div>
          <p style={{ fontSize: 11, color: '#71717a', marginTop: 16, marginBottom: 6 }}>Error detail (screenshot this if it persists):</p>
          <pre style={{ margin: 0, padding: 12, background: '#0a0a0a', border: '1px solid #27272a', borderRadius: 8, fontSize: 11, color: '#a1a1aa', overflow: 'auto', maxHeight: 220, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{detail}</pre>
        </div>
      </div>
    );
  }
}
