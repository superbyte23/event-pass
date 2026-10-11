import { Link } from "react-router-dom";
import { Image } from "@/components/ui/image";
import { EventStatusBadge } from "@/components/StatusBadge";
import { formatDateShort, timeRangeLabel } from "@/lib/event-utils";
import { MapPin, CalendarDays, Clock } from "lucide-react";

export default function EventCard({ event, footer }) {
  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
      <Link to={`/events/${event.slug}`} className="block">
        <div className="relative aspect-[16/9] overflow-hidden bg-muted">
          {event.cover_image ? (
            <Image src={event.cover_image} fittingType="fill" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
              <CalendarDays className="w-10 h-10" />
            </div>
          )}
          <div className="absolute left-3 top-3">
            <EventStatusBadge status={event.status} className="bg-white/90 backdrop-blur" />
          </div>
          {event.logo && (
            <div className="absolute right-3 top-3 h-10 w-10 overflow-hidden rounded-lg border-2 border-white bg-white shadow-sm">
              <Image src={event.logo} fittingType="fill" className="h-full w-full object-contain" />
            </div>
          )}
        </div>
      </Link>
      <div className="p-5">
        <Link to={`/events/${event.slug}`}>
          <h3 className="text-lg font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {event.name}
          </h3>
        </Link>
        <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 shrink-0" /> {formatDateShort(event.date)}
          </div>
          {event.start_time && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0" /> {timeRangeLabel(event.start_time, event.end_time)}
            </div>
          )}
          {event.venue && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 shrink-0" /> <span className="truncate">{event.venue}</span>
            </div>
          )}
        </div>
        {footer}
      </div>
    </div>
  );
}