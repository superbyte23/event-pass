'use client';

// Last-resort boundary when the root layout itself fails. It replaces the
// layout, so styles are inline rather than Tailwind classes from index.css.
export default function GlobalError({ reset }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', color: '#0f172a', fontFamily: 'ui-sans-serif, system-ui, sans-serif', padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 64, fontWeight: 300, color: '#cbd5e1' }}>500</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#64748b' }}>Server error</p>
          <h1 style={{ margin: '16px 0 0', fontSize: 28 }}>Something went wrong</h1>
          <p style={{ margin: '12px 0 0', lineHeight: 1.6, color: '#64748b' }}>
            The app couldn&apos;t start right now. Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 28, marginRight: 8, padding: '10px 16px', border: 0, borderRadius: 8, background: '#0f172a', color: '#ffffff', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            Try again
          </button>
          <a href="/" style={{ marginTop: 28, padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#ffffff', color: '#0f172a', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
            Go home
          </a>
        </div>
      </body>
    </html>
  );
}
