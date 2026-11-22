// Next.js 404 boundary (the SPA has its own catch-all route; this covers
// requests that never reach it). Plain anchors keep it usable without the
// react-router context the SPA mounts later.
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md text-center text-foreground">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 ring-1 ring-slate-200">
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" strokeWidth={2} />
            <path strokeLinecap="round" strokeWidth={2} d="m20 20-4-4" />
          </svg>
        </div>
        <p className="mt-8 text-6xl font-light tracking-tight text-muted-foreground/25">404</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Not found</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Page not found</h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a href="/events" className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            Browse events
          </a>
          <a href="/" className="inline-flex items-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            Go home
          </a>
        </div>
      </div>
    </main>
  );
}
