import { db } from "@/api/db";

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import SiteNav from "@/components/SiteNav";
import EventCard from "@/components/EventCard";
import { Button } from "@/components/ui/button";
import { Ticket, ArrowRight, Sparkles, ShieldCheck, QrCode } from "lucide-react";

export default function Home() {
  const [events, setEvents] = useState(null);

  useEffect(() => {
    db.entities.Event.list("-created_date", 6).then(setEvents).catch(() => setEvents([]));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-background to-background" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="w-3.5 h-3.5" /> Registration & QR ticketing
          </span>
          <h1 className="mt-6 text-4xl sm:text-6xl font-bold tracking-tight text-foreground">
            Beautiful events.<br />
            <span className="text-primary">One-tap tickets.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            Discover events, register with your Google account, and get a polished digital ticket with a scannable QR code — instantly.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/events">Browse events <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/my-events"><Ticket className="w-4 h-4 mr-1.5" /> My tickets</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Upcoming events</h2>
            <p className="mt-1 text-sm text-muted-foreground">Register and receive your ticket in seconds.</p>
          </div>
          <Link to="/events" className="text-sm font-medium text-primary hover:underline">View all →</Link>
        </div>
        {events === null ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-72 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
            No events published yet. Check back soon.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        )}
      </section>

      <section className="border-t border-border bg-slate-50/50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              { icon: QrCode, title: "Instant QR tickets", desc: "Every registration gets a unique, secure QR code tied to your account." },
              { icon: ShieldCheck, title: "One account, one ticket", desc: "Your Google account can register once per event — no duplicates." },
              { icon: Ticket, title: "Always in your pocket", desc: "Open your ticket anytime from any device to show at the door." },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}