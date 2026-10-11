import { db } from "@/api/db";

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

import { useAuth } from "@/lib/AuthContext";
import SiteNav from "@/components/SiteNav";
import { Image } from "@/components/ui/image";
import { EventStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { registrationAvailability, formatDate, timeRangeLabel } from "@/lib/event-utils";
import { CalendarDays, Clock, MapPin, Users, Ticket as TicketIcon, CheckCircle2, Loader2 } from "lucide-react";

export default function EventDetail() {
  const { slug } = useParams();
  const { user, googleAuthEnabled } = useAuth();
  const googleMode = googleAuthEnabled !== false;
  const [event, setEvent] = useState(undefined);
  const [myReg, setMyReg] = useState(null);
  const [confirmedCount, setConfirmedCount] = useState(null);

  useEffect(() => {
    setEvent(undefined);
    db.entities.Event.filter({ slug })
      .then((list) => setEvent(list && list[0] ? list[0] : null))
      .catch(() => setEvent(null));
  }, [slug]);

  useEffect(() => {
    setMyReg(null);
    if (!event) return;
    if (user && googleMode) {
      db.entities.Registration.filter({ event_id: event.id })
        .then((list) => setMyReg((list || []).find((r) => r.status !== "cancelled") || false))
        .catch(() => setMyReg(false));
    } else {
      setMyReg(false);
    }
    if (user?.role === "admin") {
      db.entities.Registration.filter({ event_id: event.id, status: "confirmed" })
        .then((list) => setConfirmedCount((list || []).length))
        .catch(() => setConfirmedCount(null));
    }
  }, [event, user]);

  const availability = event ? registrationAvailability(event, confirmedCount) : null;

  if (event === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (event === null) {
    return (
      <div className="min-h-screen bg-background">
        <SiteNav />
        <div className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="text-3xl font-semibold">Event not found</h1>
          <p className="mt-2 text-muted-foreground">This event may have been removed or is no longer public.</p>
          <Button asChild className="mt-6"><Link to="/events">Browse events</Link></Button>
        </div>
      </div>
    );
  }

  const accent = event.accent_color || "#0f172a";
  const alreadyRegistered = !!myReg;

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />

      {/* Hero */}
      <div className="relative">
        <div className="relative h-56 w-full overflow-hidden bg-muted sm:h-80">
          {event.cover_image ? (
            <Image src={event.cover_image} fittingType="fill" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-slate-200 to-slate-400" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 mx-auto max-w-4xl px-4 sm:px-6 pb-6 sm:pb-8">
            <div className="flex items-end gap-4">
              {event.logo && (
                <div className="hidden sm:block h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 border-white bg-white shadow-md">
                  <Image src={event.logo} fittingType="fill" className="h-full w-full object-contain" />
                </div>
              )}
              <div className="text-white">
                <EventStatusBadge status={event.status} className="bg-white/90" />
                <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-4xl drop-shadow-sm">{event.name}</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
        <div className="grid gap-3 sm:grid-cols-3">
          <DetailTile icon={CalendarDays} label="Date" value={formatDate(event.date)} />
          <DetailTile icon={Clock} label="Time" value={timeRangeLabel(event.start_time, event.end_time) || "—"} />
          <DetailTile icon={MapPin} label="Venue" value={event.venue || "—"} sub={event.venue_address} />
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                {availability?.capacity ? (
                  <>
                    <span>Capacity {availability.capacity}</span>
                    {confirmedCount !== null && (
                      <span className="text-muted-foreground/70">· {confirmedCount} registered · {availability.remaining} left</span>
                    )}
                  </>
                ) : (
                  <span>Open registration</span>
                )}
              </div>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {alreadyRegistered ? "You're registered" : availability?.canRegister ? "Registration is open" : availability?.reason}
              </p>
            </div>

            <div className="shrink-0">
              {alreadyRegistered ? (
                <Button asChild size="lg" style={{ backgroundColor: accent }}>
                  <Link to={`/tickets/${myReg.id}`}><TicketIcon className="w-4 h-4 mr-1.5" /> View my ticket</Link>
                </Button>
              ) : availability?.canRegister ? (
                <Button asChild size="lg" style={{ backgroundColor: accent }}>
                  <Link to={`/register/${event.slug}`}><TicketIcon className="w-4 h-4 mr-1.5" /> Register now</Link>
                </Button>
              ) : (
                <Button size="lg" disabled style={{ backgroundColor: accent }}>Register now</Button>
              )}
            </div>
          </div>

          {alreadyRegistered && (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
              <CheckCircle2 className="mt-0.5 w-5 h-5 shrink-0" />
              <div className="text-sm">
                You're already registered for this event. <span className="font-mono">{myReg.registration_number}</span>
                <div className="mt-1 text-emerald-700">Open your digital ticket anytime to show the QR at entry.</div>
              </div>
            </div>
          )}
          {availability?.canRegister && !alreadyRegistered && (
            <p className="mt-4 text-xs text-muted-foreground">{googleMode ? "You'll sign in with Google and fill in a short form — one account, one guest per event." : "Fill in a short form — one registration per guest per event."}</p>
          )}
          {!alreadyRegistered && (
            <div className="mt-4 border-t border-border pt-4 text-center">
              <Link to={`/find-ticket?event=${event.slug}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Already registered? Find your ticket
              </Link>
            </div>
          )}
        </div>

        {event.description && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">About this event</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-foreground/90">{event.description}</p>
          </div>
        )}

        {event.venue_address && (
          <div className="mt-8 flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 w-4 h-4 shrink-0" /> {event.venue_address}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailTile({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="mt-1.5 font-semibold text-foreground">{value}</div>
      {sub && <div className="text-sm text-muted-foreground">{sub}</div>}
    </div>
  );
}