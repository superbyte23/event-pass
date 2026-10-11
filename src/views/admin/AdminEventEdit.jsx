import { db } from "@/api/db";

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import EventForm from "@/components/EventForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { slugify } from "@/lib/event-utils";

export default function AdminEventEdit() {
  const { event: eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { db.entities.Event.get(eventId).then(setEvent).catch(() => setEvent(null)); }, [eventId]);

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    setError("");
    try {
      await db.entities.Event.update(eventId, { ...payload, slug: slugify(payload.slug || payload.name) });
      navigate(`/admin/events/${eventId}`);
    } catch (e) {
      setError(e?.message || "Could not save changes.");
      setSubmitting(false);
    }
  };

  if (event === undefined) return <div className="flex h-64 items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  if (event === null) return <div className="py-20 text-center text-muted-foreground">Event not found.</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/events/${eventId}`)} className="mb-2"><ArrowLeft className="w-4 h-4 mr-1.5" /> Back</Button>
        <h1 className="text-2xl font-bold tracking-tight">Edit event</h1>
        <p className="text-sm text-muted-foreground">{event.name}</p>
      </div>
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <EventForm initialEvent={event} onSubmit={handleSubmit} submitting={submitting} submitLabel="Save changes" />
      </div>
    </div>
  );
}