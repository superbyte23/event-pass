import { db } from "@/api/db";

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import EventForm from "@/components/EventForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { slugify } from "@/lib/event-utils";

export default function AdminEventCreate() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    setError("");
    try {
      const data = { ...payload, slug: slugify(payload.slug || payload.name) };
      const created = await db.entities.Event.create(data);
      navigate(`/admin/events/${created.id}`);
    } catch (e) {
      setError(e?.message || "Could not create event. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/events")} className="mb-2"><ArrowLeft className="w-4 h-4 mr-1.5" /> Events</Button>
        <h1 className="text-2xl font-bold tracking-tight">Create event</h1>
        <p className="text-sm text-muted-foreground">Set up a new event and its registration.</p>
      </div>
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <EventForm onSubmit={handleSubmit} submitting={submitting} submitLabel="Create event" />
      </div>
    </div>
  );
}