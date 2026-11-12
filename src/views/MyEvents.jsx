import { db } from "@/api/db";

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "@/lib/AuthContext";
import SiteNav from "@/components/SiteNav";
import { Image } from "@/components/ui/image";
import { EventStatusBadge, RegStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { formatDateShort, timeRangeLabel } from "@/lib/event-utils";
import { Ticket as TicketIcon, CalendarDays, Clock, MapPin, ArrowRight, Trash2, AlertCircle } from "lucide-react";

export default function MyEvents() {
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Server-scoped by the session: includes guest tickets registered with
        // this account's email, not just rows stamped with its user_id.
        const regs = await db.entities.Registration.mine();
        const events = await Promise.all(
          (regs || []).map((r) => db.entities.Event.get(r.event_id).catch(() => null))
        );
        if (!alive) return;
        setItems(
          (regs || []).map((r, i) => ({ registration: r, event: events[i] })).filter((x) => x.event)
        );
      } catch {
        if (alive) setItems([]);
      }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const handleDelete = async (registrationId) => {
    try {
      await db.entities.Registration.delete(registrationId);
      setItems((prev) => (prev || []).filter((x) => x.registration.id !== registrationId));
    } catch (error) {
      console.error('Failed to delete registration:', error);
      alert('Failed to cancel registration. Please try again.');
    }
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      handleDelete(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-background">
        <SiteNav />
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
          <h1 className="text-3xl font-bold tracking-tight">My tickets</h1>
          <p className="mt-1 text-muted-foreground">Events you've registered for, {user?.full_name?.split(" ")[0] || "there"}.</p>

          <div className="mt-8">
            {items === null ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => <div key={i} className="h-72 rounded-2xl bg-muted animate-pulse" />)}
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center">
                <TicketIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-muted-foreground">You haven't registered for any events yet.</p>
                <Button asChild className="mt-4"><Link to="/events">Browse events <ArrowRight className="w-4 h-4 ml-1.5" /></Link></Button>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(({ registration, event }) => (
                  <div key={registration.id} className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:shadow-md">
                    <Link to={`/events/${event.slug}`} className="block">
                      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                        {event.cover_image ? (
                          <Image src={event.cover_image} fittingType="fill" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400"><CalendarDays className="w-10 h-10" /></div>
                        )}
                        <div className="absolute left-3 top-3"><RegStatusBadge status={registration.status} className="bg-white/90 backdrop-blur" /></div>
                      </div>
                    </Link>
                    <div className="p-5">
                      <Link to={`/events/${event.slug}`}><h3 className="text-lg font-semibold leading-snug line-clamp-2 hover:text-primary transition-colors">{event.name}</h3></Link>
                      <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2"><CalendarDays className="w-4 h-4 shrink-0" /> {formatDateShort(event.date)}</div>
                        {event.start_time && <div className="flex items-center gap-2"><Clock className="w-4 h-4 shrink-0" /> {timeRangeLabel(event.start_time, event.end_time)}</div>}
                        {event.venue && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 shrink-0" /> <span className="truncate">{event.venue}</span></div>}
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                        <span className="font-mono text-xs text-muted-foreground">{registration.registration_number}</span>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteConfirm(registration.id)}>
                            <Trash2 className="w-4 h-4 mr-1.5" /> Cancel
                          </Button>
                          <Button asChild size="sm"><Link to={`/tickets/${registration.id}`}>View ticket <TicketIcon className="w-4 h-4 ml-1.5" /></Link></Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="mb-2 text-center text-lg font-semibold">Cancel registration?</h3>
            <p className="mb-6 text-center text-sm text-muted-foreground">
              This will cancel your ticket for this event. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>
                Keep registration
              </Button>
              <Button variant="destructive" className="flex-1" onClick={confirmDelete}>
                Yes, cancel it
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}