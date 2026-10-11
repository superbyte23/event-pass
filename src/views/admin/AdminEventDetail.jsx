import { db } from "@/api/db";

import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Image } from "@/components/ui/image";
import { EventStatusBadge, RegStatusBadge } from "@/components/StatusBadge";
import { formatDate, formatDateTime, timeRangeLabel } from "@/lib/event-utils";
import { Pencil, Users, ExternalLink, Trash2, Eye, ArrowLeft, Globe, GlobeLock } from "lucide-react";

export default function AdminEventDetail() {
  const { event: eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(undefined);
  const [regs, setRegs] = useState([]);

  const load = () => {
    db.entities.Event.get(eventId).then(setEvent).catch(() => setEvent(null));
    db.entities.Registration.filter({ event_id: eventId }).then((l) => setRegs(l || [])).catch(() => setRegs([]));
  };
  useEffect(() => { load(); }, [eventId]);

  if (event === undefined) return <div className="flex h-64 items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  if (event === null) return <div className="py-20 text-center text-muted-foreground">Event not found. <Link to="/admin/events" className="text-primary hover:underline">Back to events</Link></div>;

  const confirmed = regs.filter((r) => r.status !== "cancelled");
  const checkedIn = regs.filter((r) => r.status === "checked_in").length;
  const capacity = event.max_attendees && event.max_attendees > 0 ? event.max_attendees : null;
  const remaining = capacity !== null ? Math.max(0, capacity - confirmed.length) : null;
  const recent = [...regs].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 5);

  const togglePublish = async () => { await db.entities.Event.update(event.id, { published: !event.published }); load(); };
  const handleDelete = async () => {
    if (!confirm(`Delete "${event.name}"? This also removes its registrations.`)) return;
    try { await db.entities.Registration.deleteMany({ event_id: event.id }); } catch {}
    await db.entities.Event.delete(event.id);
    navigate("/admin/events");
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/events")}><ArrowLeft className="w-4 h-4 mr-1.5" /> Events</Button>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="relative h-40 bg-muted sm:h-52">
          {event.cover_image ? <Image src={event.cover_image} fittingType="fill" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-slate-200 to-slate-400" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 flex items-end gap-3 p-5">
            {event.logo && <div className="h-12 w-12 overflow-hidden rounded-lg border-2 border-white bg-white"><Image src={event.logo} fittingType="fill" className="h-full w-full object-contain" /></div>}
            <div className="text-white">
              <EventStatusBadge status={event.status} className="bg-white/90" />
              <h1 className="mt-1 text-xl font-bold sm:text-2xl">{event.name}</h1>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 p-4">
          <Button asChild size="sm" variant="outline"><Link to={`/admin/events/${event.id}/edit`}><Pencil className="w-3.5 h-3.5 mr-1" /> Edit</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to={`/admin/events/${event.id}/registrations`}><Users className="w-3.5 h-3.5 mr-1" /> Registrations</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to={`/events/${event.slug}`} target="_blank"><ExternalLink className="w-3.5 h-3.5 mr-1" /> Public page</Link></Button>
          <Button size="sm" variant="ghost" onClick={togglePublish}>{event.published ? <><GlobeLock className="w-3.5 h-3.5 mr-1" /> Unpublish</> : <><Globe className="w-3.5 h-3.5 mr-1" /> Publish</>}</Button>
          <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700" onClick={handleDelete}><Trash2 className="w-3.5 h-3.5 mr-1" /> Delete</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Registrations" value={confirmed.length} />
        <Stat label="Capacity" value={capacity ?? "∞"} />
        <Stat label="Remaining" value={remaining ?? "—"} />
        <Stat label="Checked in" value={checkedIn} />
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Details</h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Field label="Date" value={formatDate(event.date)} />
          <Field label="Time" value={timeRangeLabel(event.start_time, event.end_time) || "—"} />
          <Field label="Venue" value={event.venue || "—"} />
          <Field label="Address" value={event.venue_address || "—"} />
          <Field label="Slug" value={`/events/${event.slug}`} />
          <Field label="Max attendees" value={event.max_attendees || "Unlimited"} />
          <Field label="Registration opens" value={event.registration_start ? formatDateTime(event.registration_start) : "—"} />
          <Field label="Registration closes" value={event.registration_end ? formatDateTime(event.registration_end) : "—"} />
        </dl>
        {event.description && <p className="mt-4 whitespace-pre-line text-sm text-foreground/90 border-t border-border pt-4">{event.description}</p>}
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent registrations</h2>
          <Button asChild size="sm" variant="ghost"><Link to={`/admin/events/${event.id}/registrations`}>View all</Link></Button>
        </div>
        {recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No registrations yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {recent.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-mono text-xs">{r.registration_number}</span>
                <div className="flex items-center gap-3">
                  <RegStatusBadge status={r.status} />
                  <Button asChild size="sm" variant="ghost"><Link to={`/admin/registrations/${r.id}`}><Eye className="w-3.5 h-3.5" /></Link></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <Card className="p-4">
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Card>
  );
}
function Field({ label, value }) {
  return (<div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-0.5 font-medium">{value}</dd></div>);
}