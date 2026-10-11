import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";

import SiteNav from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RegStatusBadge } from "@/components/StatusBadge";
import { findGuestTickets } from "@/lib/registration";
import { db } from "@/api/db";
import { Search, Ticket as TicketIcon, Loader2, ArrowLeft, MailWarning } from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return "";
  }
}

export default function FindTicket() {
  const [params] = useSearchParams();
  const eventSlug = params.get("event") || "";
  const prefillEmail = params.get("email") || "";

  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState(null);
  const [email, setEmail] = useState(prefillEmail);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!eventSlug) return;
    let alive = true;
    db.entities.Event.filter({ slug: eventSlug })
      .then((list) => {
        if (!alive) return;
        const ev = list && list[0] ? list[0] : null;
        setEvents(ev ? [ev] : []);
        setEventId(ev ? ev.id : null);
      })
      .catch(() => { if (alive) setEventId(null); });
    return () => { alive = false; };
  }, [eventSlug]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) { setError("Enter the email you registered with."); return; }
    if (!EMAIL_RE.test(value)) { setError("Enter a valid email address."); return; }
    setError("");
    setLoading(true);
    try {
      const tickets = await findGuestTickets({ email: value, eventId });
      setResults(tickets);
      try { localStorage.setItem("eventpass.guestEmail", value); } catch { /* ignore */ }
    } catch (err) {
      setResults([]);
      setError(err?.message || "Could not look up your tickets.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12 sm:py-16">
        <Link to="/events" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Events
        </Link>

        <div className="mt-6">
          <h1 className="text-3xl font-bold tracking-tight">Find your tickets</h1>
          <p className="mt-2 text-muted-foreground">
            Enter the email you registered with {events.length > 0 ? `for ${events[0].name}` : "with"} — we&apos;ll pull up your
            guest tickets.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="find-ticket-email">Email</Label>
            <Input
              id="find-ticket-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1.5"
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Search className="w-4 h-4 mr-1.5" />}
            Find tickets
          </Button>
        </form>
        {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}

        {results && (
          <div className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {results.length === 0 ? "No tickets found" : `${results.length} ticket${results.length === 1 ? "" : "s"}`}
            </h2>

            {results.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                <MailWarning className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-muted-foreground">
                  No guest tickets were found for <span className="font-medium text-foreground">{email.trim()}</span>.
                </p>
                <div className="mt-5 flex items-center justify-center gap-3">
                  {eventSlug && (
                    <Button asChild variant="outline">
                      <Link to={`/register/${eventSlug}`}>Register for this event</Link>
                    </Button>
                  )}
                  <Button asChild>
                    <Link to="/events">Browse events</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {results.map((reg) => (
                  <li key={reg.id} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <TicketIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{reg.event_name || "Event"}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                        <span className="font-mono">{reg.registration_number}</span>
                        <RegStatusBadge status={reg.status} />
                        {formatDate(reg.created_date) && <span>{formatDate(reg.created_date)}</span>}
                      </p>
                    </div>
                    <Button asChild size="sm">
                      <Link to={`/tickets/${reg.id}`}>View ticket</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}