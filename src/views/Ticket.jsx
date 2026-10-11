import { db } from "@/api/db";

import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

import { useAuth } from "@/lib/AuthContext";
import SiteNav from "@/components/SiteNav";
import QRCode from "@/components/QRCode";
import { RegStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { qrCheckinUrl, formatDate, timeRangeLabel } from "@/lib/event-utils";
import { Loader2, CalendarDays, Clock, MapPin, Ticket as TicketIcon, Printer, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function Ticket() {
  const { registration } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reg, setReg] = useState(undefined);
  const [event, setEvent] = useState(undefined);
  const [guest, setGuest] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await db.entities.Registration.get(registration);
        if (!alive) return;
        setReg(r);
        // guest info: own profile if owner, else fetch the user record (admin)
        if (!r.user_id) {
          setGuest({ full_name: r.guest_name, email: r.guest_email, image: null });
        } else if (r.user_id === user?.id) {
          setGuest({ full_name: user.full_name, email: user.email, image: user.image });
        } else {
          try {
            const u = await db.entities.User.get(r.user_id);
            setGuest(u);
          } catch { setGuest(null); }
        }
        try {
          const e = await db.entities.Event.get(r.event_id);
          if (alive) setEvent(e);
        } catch { if (alive) setEvent(null); }
      } catch {
        if (alive) setReg(null);
      }
    })();
    return () => { alive = false; };
  }, [registration, user?.id]);

  if (reg === undefined || event === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (reg === null) {
    return (
      <div className="min-h-screen bg-background">
        <SiteNav />
        <div className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold">Ticket not found</h1>
          <p className="mt-2 text-muted-foreground">This ticket may have been cancelled or doesn't belong to your account.</p>
          <Button asChild className="mt-6"><Link to={user ? "/my-events" : "/events"}>{user ? "My tickets" : "Browse events"}</Link></Button>
        </div>
      </div>
    );
  }

  const accent = event?.accent_color || "#0f172a";
  const qrValue = qrCheckinUrl(reg.qr_token);

  return (
    <div className="min-h-screen bg-slate-100">
      <SiteNav />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        {reg.status === "checked_in" && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-800">
            <CheckCircle2 className="w-5 h-5 shrink-0" /> Checked in{reg.checked_in_at ? ` · ${formatDate(reg.checked_in_at)}` : ""}
          </div>
        )}

        {/* Ticket card */}
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-black/5 print:shadow-none print:ring-0">
          {/* Branding band */}
          <div className="relative px-6 pt-6 pb-5 sm:px-8" style={{ backgroundColor: accent }}>
            <div className="flex items-center gap-3">
              {event?.logo ? (
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white p-1">
                  <Image src={event.logo} fittingType="fill" className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-white">
                  <TicketIcon className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-white/70">Event Pass</p>
                <h1 className="truncate text-lg font-bold text-white sm:text-xl">{event?.name || reg.event_name}</h1>
              </div>
            </div>
            {event?.cover_image && (
              <div className="mt-4 h-20 w-full overflow-hidden rounded-xl sm:h-28">
                <Image src={event.cover_image} fittingType="fill" className="h-full w-full object-cover opacity-90" />
              </div>
            )}
          </div>

          {/* Event details */}
          <div className="grid grid-cols-1 gap-3 px-6 py-5 sm:grid-cols-3 sm:px-8">
            <Detail icon={CalendarDays} label="Date" value={event ? formatDate(event.date) : "—"} />
            <Detail icon={Clock} label="Time" value={event ? timeRangeLabel(event.start_time, event.end_time) : "—"} />
            <Detail icon={MapPin} label="Venue" value={event?.venue || "—"} sub={event?.venue_address} />
          </div>

          {/* Perforated divider */}
          <div className="relative">
            <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-slate-100" />
            <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-slate-100" />
            <div className="mx-6 border-t-2 border-dashed border-slate-200 sm:mx-8" />
          </div>

          {/* Guest + QR stub */}
          <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-5 sm:p-8">
            <div className="sm:col-span-3">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Guest</p>
              <div className="mt-3 flex items-center gap-3">
                {guest?.image ? (
                  <img src={guest.image} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold text-white" style={{ backgroundColor: accent }}>
                    {(guest?.full_name || guest?.email || "?").charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{guest?.full_name || "Guest"}</p>
                  <p className="truncate text-sm text-slate-500">{guest?.email}</p>
                </div>
              </div>
              <div className="mt-5">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Registration No.</p>
                <p className="mt-1 font-mono text-lg font-semibold tracking-wider text-slate-900">{reg.registration_number}</p>
                <div className="mt-3"><RegStatusBadge status={reg.status} /></div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center sm:col-span-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <QRCode value={qrValue} size={180} className="rounded-lg" />
              </div>
              <p className="mt-3 text-center text-xs font-medium uppercase tracking-wider text-slate-400">Present at entry</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 print:hidden">
          <Button variant="outline" onClick={() => navigate(user ? "/my-events" : "/events")}><ArrowLeft className="w-4 h-4 mr-1.5" /> {user ? "My tickets" : "Browse events"}</Button>
          <Button onClick={() => window.print()}><Printer className="w-4 h-4 mr-1.5" /> Print ticket</Button>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400 print:hidden">
          Keep this ticket on your phone. The QR code is unique to your registration.
        </p>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, value, sub }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-400">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="mt-1 font-semibold text-slate-900">{value}</div>
      {sub && <div className="text-sm text-slate-500">{sub}</div>}
    </div>
  );
}