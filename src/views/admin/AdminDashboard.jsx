import { db } from "@/api/db";

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EventStatusBadge } from "@/components/StatusBadge";
import { formatDateShort } from "@/lib/event-utils";
import { CalendarDays, Ticket as TicketIcon, UserCheck, TrendingUp, Plus, ArrowRight } from "lucide-react";

function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export default function AdminDashboard() {
  const [events, setEvents] = useState(null);
  const [regs, setRegs] = useState(null);

  useEffect(() => {
    Promise.all([
      db.entities.Event.list("-created_date", 1000),
      db.entities.Registration.list("-created_date", 1000),
    ]).then(([e, r]) => { setEvents(e || []); setRegs(r || []); }).catch(() => { setEvents([]); setRegs([]); });
  }, []);

  if (!events || !regs) {
    return <div className="flex h-64 items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  }

  const totalEvents = events.length;
  const totalRegs = regs.length;
  const todayRegs = regs.filter((r) => isToday(r.created_date)).length;
  const totalCheckIns = regs.filter((r) => r.status === "checked_in").length;

  const perEvent = events.map((e) => {
    const eventRegs = regs.filter((r) => r.event_id === e.id);
    const confirmed = eventRegs.filter((r) => r.status !== "cancelled");
    const checkedIn = eventRegs.filter((r) => r.status === "checked_in").length;
    const capacity = e.max_attendees && e.max_attendees > 0 ? e.max_attendees : null;
    const remaining = capacity !== null ? Math.max(0, capacity - confirmed.length) : null;
    return { event: e, registrations: confirmed.length, capacity, remaining, checkedIn };
  });

  const stats = [
    { label: "Total events", value: totalEvents, icon: CalendarDays, tone: "bg-slate-100 text-slate-700" },
    { label: "Total registrations", value: totalRegs, icon: TicketIcon, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Today's registrations", value: todayRegs, icon: TrendingUp, tone: "bg-indigo-50 text-indigo-700" },
    { label: "Total check-ins", value: totalCheckIns, icon: UserCheck, tone: "bg-amber-50 text-amber-700" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your events and registrations.</p>
        </div>
        <Button asChild><Link to="/admin/events/create"><Plus className="w-4 h-4 mr-1.5" /> New event</Link></Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${s.tone}`}><s.icon className="w-5 h-5" /></div>
            <div className="text-3xl font-bold tracking-tight">{s.value}</div>
            <div className="text-sm text-muted-foreground">{s.label}</div>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Events</h2>
        {perEvent.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            No events yet. <Link to="/admin/events/create" className="text-primary hover:underline">Create your first event</Link>.
          </div>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Event</th>
                    <th className="px-4 py-3 font-medium">Registrations</th>
                    <th className="px-4 py-3 font-medium">Capacity</th>
                    <th className="px-4 py-3 font-medium">Remaining</th>
                    <th className="px-4 py-3 font-medium">Check-ins</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {perEvent.map(({ event, registrations, capacity, remaining, checkedIn }) => (
                    <tr key={event.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{event.name}</div>
                        <div className="text-xs text-muted-foreground">{formatDateShort(event.date)}</div>
                      </td>
                      <td className="px-4 py-3 font-medium">{registrations}</td>
                      <td className="px-4 py-3">{capacity ?? "—"}</td>
                      <td className="px-4 py-3">{remaining ?? "—"}</td>
                      <td className="px-4 py-3">{checkedIn}</td>
                      <td className="px-4 py-3"><EventStatusBadge status={event.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button asChild size="sm" variant="outline"><Link to={`/admin/events/${event.id}`}>View</Link></Button>
                          <Button asChild size="sm" variant="ghost"><Link to={`/admin/events/${event.id}/registrations`}>Registrations <ArrowRight className="w-3.5 h-3.5 ml-1" /></Link></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}