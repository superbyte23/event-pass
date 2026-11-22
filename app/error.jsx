'use client';

import { useEffect } from 'react';

// Next.js error boundary for the route shell. The SPA owns its own router, so
// these boundaries deliberately use plain anchors instead of react-router Link.
export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('[app]', error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md text-center text-foreground">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86 1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <p className="mt-8 text-6xl font-light tracking-tight text-muted-foreground/25">500</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Server error</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Something went wrong</h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          The app couldn&apos;t load right now. Please try again in a moment.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            Try again
          </button>
          <a href="/" className="inline-flex items-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            Go home
          </a>
        </div>
      </div>
    </main>
  );
}
