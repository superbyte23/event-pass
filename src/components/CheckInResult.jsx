import { useEffect, useState } from "react";

import { db } from "@/api/db";
import { useAuth } from "@/lib/AuthContext";
import Avatar from "@/components/Avatar";
import { RegStatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/event-utils";
import { resolveAttendeeProfile } from "@/lib/attendee";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Loader2, UserCheck } from "lucide-react";

export default function CheckInResult({ result, error, busy }) {
  const { user } = useAuth();
  const reg = result?.registration;
  const [event, setEvent] = useState(null);
  const [guest, setGuest] = useState(null);

  useEffect(() => {
    setEvent(null);
    setGuest(null);
    if (!reg) return;
    let alive = true;
    db.entities.Event.get(reg.event_id).then((e) => { if (alive) setEvent(e); }).catch(() => { if (alive) setEvent(null); });
    resolveAttendeeProfile(reg, user)
      .then((profile) => { if (alive) setGuest(profile); })
      .catch(() => { if (alive) setGuest(null); });
    return () => { alive = false; };
  }, [reg, user]);

  if (busy) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-card p-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Checking in…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
        <div className="flex items-center gap-2 font-semibold"><AlertCircle className="h-5 w-5" /> Check-in failed</div>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    );
  }

  if (!reg) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Scan a ticket QR or enter a code to check an attendee in.
      </div>
    );
  }

  const already = !!result?.already;
  const name = guest?.full_name || "Guest";
  const email = guest?.email || "";

  return (
    <div className={cn("rounded-2xl border p-5", already ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50")}>
      <div className={cn("flex items-center gap-2 font-semibold", already ? "text-amber-800" : "text-emerald-800")}>
        {already ? <UserCheck className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
        {already ? "Already checked in" : "Check-in successful"}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <Avatar
          src={guest?.image}
          name={name}
          className="h-12 w-12"
          fallbackClassName="text-lg"
        />
        <div className="min-w-0">
          <div className="font-semibold truncate">{name}</div>
          <div className="text-sm text-muted-foreground truncate">{email || event?.name || ""}</div>
        </div>
      </div>

      {(reg.registration_number || event?.name) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-foreground/80">{reg.registration_number}</span>
          <RegStatusBadge status={reg.status} />
          {event?.name && <span className="text-sm text-muted-foreground">{event.name}</span>}
        </div>
      )}
      {reg.checked_in_at && (
        <div className="mt-2 text-xs text-muted-foreground">Checked in {formatDateTime(reg.checked_in_at)}</div>
      )}
    </div>
  );
}