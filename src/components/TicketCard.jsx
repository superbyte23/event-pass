import Avatar from "@/components/Avatar";
import QRCode from "@/components/QRCode";
import { Image } from "@/components/ui/image";
import { formatDate, timeRangeLabel, qrCheckinUrl } from "@/lib/event-utils";
import { CalendarDays, Clock, MapPin, Ticket as TicketIcon } from "lucide-react";

// The ticket itself, shared by the attendee ticket page and the admin preview.
export default function TicketCard({ reg, event, guest }) {
  const accent = event?.accent_color || "#0f172a";
  const qrValue = qrCheckinUrl(reg.qr_token);

  // Registration answers that are not already shown as the guest name/email.
  const normalize = (value) => String(value ?? "").trim().toLowerCase();
  const shownValues = new Set(
    [guest?.full_name, guest?.email, reg.guest_name, reg.guest_email]
      .map(normalize)
      .filter(Boolean),
  );
  const fieldDetails = (event?.form_fields || [])
    .map((field) => {
      const raw = reg.responses?.[field.id];
      if (raw === undefined || raw === null || raw === "") return null;
      const value = Array.isArray(raw) ? raw.join(", ") : String(raw);
      if (!value.trim() || shownValues.has(normalize(value))) return null;
      return { id: field.id, label: field.label || "Field", value };
    })
    .filter(Boolean);

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-black/5 print:shadow-none print:ring-0">
      {/* Branding band — the event cover fills the header behind the title */}
      <div
        className="relative flex aspect-[4/3] w-full flex-col justify-end overflow-hidden px-6 pb-6 pt-6 sm:px-8 sm:pb-7"
        style={{ backgroundColor: accent }}
      >
        {event?.cover_image && (
          <div aria-hidden="true" className="absolute inset-0">
            <Image alt="" src={event.cover_image} fittingType="fill" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/25" />
          </div>
        )}
        <div className="relative flex items-center gap-3">
          {event?.logo ? (
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white p-1">
              <Image alt="" src={event.logo} fittingType="fill" className="h-full w-full object-contain" />
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
      </div>

      {/* Event details */}
      <div className="grid grid-cols-1 gap-3 px-6 py-5 sm:grid-cols-2 sm:px-8">
        <div className="flex flex-col gap-3">
          <Detail icon={CalendarDays} label="Date" value={event ? formatDate(event.date) : "—"} />
          <Detail icon={Clock} label="Time" value={event ? timeRangeLabel(event.start_time, event.end_time) : "—"} />
        </div>
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
            <Avatar
              src={guest?.image}
              name={guest?.full_name || guest?.email}
              className="h-12 w-12"
              fallbackClassName="text-lg text-white"
              style={guest?.image ? undefined : { backgroundColor: accent }}
            />
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{guest?.full_name || "Guest"}</p>
              <p className="truncate text-sm text-slate-500">{guest?.email}</p>
            </div>
          </div>
          <div className="mt-5">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Registration No.</p>
            <p className="mt-1 font-mono text-lg font-semibold tracking-wider text-slate-900">{reg.registration_number}</p>
          </div>
          {fieldDetails.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Field details</p>
              <ul className="mt-2 space-y-1.5">
                {fieldDetails.map((field) => (
                  <li key={field.id} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                    <span className="text-xs text-slate-400 sm:w-32 sm:shrink-0">{field.label}</span>
                    <span className="break-words text-sm font-medium text-slate-700">{field.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center sm:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <QRCode value={qrValue} size={180} className="rounded-lg" />
          </div>
          <p className="mt-3 text-center text-xs font-medium uppercase tracking-wider text-slate-400">Present at entry</p>
        </div>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, value, sub = undefined }) {
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
