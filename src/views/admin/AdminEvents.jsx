import { db } from "@/api/db";

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EventStatusBadge } from "@/components/StatusBadge";
import { Image } from "@/components/ui/image";
import { formatDateShort } from "@/lib/event-utils";
import { Plus, Pencil, Eye, Users, Trash2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function AdminEvents() {
  const [events, setEvents] = useState(null);
  const [query, setQuery] = useState("");

  const load = () => db.entities.Event.list("-created_date", 1000).then((l) => setEvents(l || [])).catch(() => setEvents([]));
  useEffect(() => { load(); }, []);

  const filtered = events ? events.filter((e) => {
    const q = query.trim().toLowerCase();
    return !q || e.name?.toLowerCase().includes(q) || e.slug?.toLowerCase().includes(q);
  }) : null;

  const handleDelete = async (e) => {
    if (!confirm(`Delete "${e.name}"? This also removes its registrations.`)) return;
    try {
      await db.entities.Registration.deleteMany({ event_id: e.id });
    } catch {}
    await db.entities.Event.delete(e.id);
    load();
  };

  const togglePublish = async (e) => {
    await db.entities.Event.update(e.id, { published: !e.published });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Events</h1>
          <p className="text-sm text-muted-foreground">Create, edit and manage your events.</p>
        </div>
        <Button asChild><Link to="/admin/events/create"><Plus className="w-4 h-4 mr-1.5" /> New event</Link></Button>
      </div>

      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events…" className="pl-9" />
      </div>

      {filtered === null ? (
        <div className="flex h-40 items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          {query ? "No events match your search." : <>No events yet. <Link to="/admin/events/create" className="text-primary hover:underline">Create one</Link>.</>}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <Card key={e.id} className="overflow-hidden">
              <div className="relative aspect-[16/9] bg-muted">
                {e.cover_image ? <Image src={e.cover_image} fittingType="fill" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-slate-100 to-slate-200" />}
                <div className="absolute left-2 top-2"><EventStatusBadge status={e.status} className="bg-white/90" /></div>
                {!e.published && <div className="absolute right-2 top-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Unpublished</div>}
              </div>
              <div className="p-4">
                <h3 className="font-semibold line-clamp-1">{e.name}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatDateShort(e.date)} · {e.venue || "No venue"}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button asChild size="sm" variant="outline"><Link to={`/admin/events/${e.id}`}><Eye className="w-3.5 h-3.5 mr-1" /> View</Link></Button>
                  <Button asChild size="sm" variant="outline"><Link to={`/admin/events/${e.id}/edit`}><Pencil className="w-3.5 h-3.5 mr-1" /> Edit</Link></Button>
                  <Button asChild size="sm" variant="outline"><Link to={`/admin/events/${e.id}/registrations`}><Users className="w-3.5 h-3.5 mr-1" /> Guests</Link></Button>
                  <Button size="sm" variant="ghost" onClick={() => togglePublish(e)}>{e.published ? "Unpublish" : "Publish"}</Button>
                  <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700" onClick={() => handleDelete(e)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}