import { db } from "@/api/db";

import { useEffect, useMemo, useState } from "react";

import SiteNav from "@/components/SiteNav";
import EventCard from "@/components/EventCard";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export default function Events() {
  const [events, setEvents] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    db.entities.Event.list("-created_date", 100).then(setEvents).catch(() => setEvents([]));
  }, []);

  const filtered = useMemo(() => {
    if (!events) return null;
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) =>
      [e.name, e.venue, e.venue_address, e.description].filter(Boolean).some((f) => f.toLowerCase().includes(q))
    );
  }, [events, query]);

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Events</h1>
            <p className="mt-1 text-muted-foreground">Find an event and claim your ticket.</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events…" className="pl-9" />
          </div>
        </div>

        <div className="mt-8">
          {filtered === null ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-72 rounded-2xl bg-muted animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
              {query ? "No events match your search." : "No events published yet."}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((e) => <EventCard key={e.id} event={e} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}