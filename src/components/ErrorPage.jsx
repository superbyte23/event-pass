import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, LogIn, RefreshCw, Search, ShieldAlert } from "lucide-react";

import SiteNav from "@/components/SiteNav";
import { buttonVariants } from "@/components/ui/button";

const TONES = {
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
  rose: "bg-rose-50 text-rose-600 ring-rose-100",
  slate: "bg-slate-100 text-slate-500 ring-slate-200",
};

// Shared shell for the SPA's error pages. Named variants below supply the
// copy, icon and useful next steps for each status. Links use buttonVariants
// directly so the pages stay usable with the project's JS typecheck setup.
export function ErrorPage({ code, label, title, description, icon: Icon, tone = "slate", children }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center sm:py-28">
        <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ring-1 ${TONES[tone]}`}>
          <Icon className="h-8 w-8" aria-hidden="true" />
        </div>
        <p className="mt-8 text-6xl font-light tracking-tight text-muted-foreground/25">{code}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-3 max-w-md leading-relaxed text-muted-foreground">{description}</p>}
        {children && <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{children}</div>}
      </div>
    </div>
  );
}

export function UnauthorizedPage({ title = "Sign in to continue", description, returnTo }) {
  const location = useLocation();
  const destination = returnTo || `${location.pathname}${location.search}`;

  return (
    <ErrorPage
      code="401"
      label="Sign in required"
      icon={LogIn}
      tone="amber"
      title={title}
      description={description || "You need to be signed in to see this page. Sign in and we'll bring you right back."}
    >
      <Link to={`/login?returnTo=${encodeURIComponent(destination)}`} className={buttonVariants()}>
        <LogIn /> Sign in
      </Link>
      <Link to="/find-ticket" className={buttonVariants({ variant: "outline" })}>Find a ticket</Link>
    </ErrorPage>
  );
}

export function ForbiddenPage({
  title = "Access denied",
  description = "You don't have permission to view this page. If you think this is a mistake, contact an organiser.",
}) {
  return (
    <ErrorPage code="403" label="Access denied" icon={ShieldAlert} tone="rose" title={title} description={description}>
      <Link to="/events" className={buttonVariants()}>Browse events</Link>
      <Link to="/" className={buttonVariants({ variant: "outline" })}>Go home</Link>
    </ErrorPage>
  );
}

export function NotFoundPage({ title = "Page not found", description }) {
  const location = useLocation();
  const path = `${location.pathname}${location.search}`;

  return (
    <ErrorPage
      code="404"
      label="Not found"
      icon={Search}
      tone="slate"
      title={title}
      description={description || (
        <>
          We couldn&apos;t find <span className="font-medium text-foreground">{path}</span>. It may have moved or no
          longer exist.
        </>
      )}
    >
      <Link to="/events" className={buttonVariants()}>Browse events</Link>
      <Link to="/find-ticket" className={buttonVariants({ variant: "outline" })}>Find a ticket</Link>
    </ErrorPage>
  );
}

export function ServerErrorPage({
  title = "Something went wrong",
  description = "We couldn't load this page right now. Please try again in a moment.",
  onRetry,
}) {
  return (
    <ErrorPage code="500" label="Server error" icon={AlertTriangle} tone="rose" title={title} description={description}>
      {onRetry && (
        <button type="button" onClick={onRetry} className={buttonVariants()}>
          <RefreshCw /> Try again
        </button>
      )}
      <Link to="/" className={buttonVariants({ variant: "outline" })}>Go home</Link>
    </ErrorPage>
  );
}

export default ErrorPage;
