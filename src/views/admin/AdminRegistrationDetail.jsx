import { db } from "@/api/db";

import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

import { useAuth } from "@/lib/AuthContext";
import TicketCard from "@/components/TicketCard";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/event-utils";
import { resolveAttendeeProfile } from "@/lib/attendee";
import { ArrowLeft, Ticket as TicketIcon, UserCheck, Undo2, Ban, ExternalLink, CheckCircle2 } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";

export default function AdminRegistrationDetail() {
  const { registration } = useParams();
  const { user } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();
  const [reg, setReg] = useState(undefined);
  const [event, setEvent] = useState(null);
  const [guest, setGuest] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    db.entities.Registration.get(registration).then(async (r) => {
      setReg(r);
      try { setEvent(await db.entities.Event.get(r.event_id)); } catch { setEvent(null); }
      try { setGuest(await resolveAttendeeProfile(r, user)); } catch { setGuest(null); }
    }).catch(() => setReg(null));
  }, [registration, user]);
  useEffect(() => { load(); }, [load]);

  const update = async (data) => {
    setBusy(true);
    try { await db.entities.Registration.update(reg.id, data); load(); } finally { setBusy(false); }
  };
  const checkIn = () => update({ status: "checked_in", checked_in_at: new Date().toISOString(), checked_in_by: user?.id });
  const undoCheckIn = () => update({ status: "confirmed", checked_in_at: null, checked_in_by: null });
  const cancel = async () => {
    const confirmed = await confirm({
      title: "Cancel registration",
      description: "Cancel this registration? This cannot be undone.",
      confirmText: "Cancel",
      variant: "destructive",
    });
    if (confirmed) update({ status: "cancelled" });
  };
  const restore = () => update({ status: "confirmed" });

  if (reg === undefined) return <div className="flex h-64 items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  if (reg === null) return <div className="py-20 text-center text-muted-foreground">Registration not found. <Link to="/admin/events" className="text-primary hover:underline">Back</Link></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <Button variant="ghost" size="sm" onClick={() => history.back()}><ArrowLeft className="w-4 h-4 mr-1.5" /> Back</Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight font-mono">{reg.registration_number}</h1>
        <p className="text-sm text-muted-foreground">{event?.name || reg.event_name}</p>
      </div>

      {reg.status === "checked_in" && (
        <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div>
            <div className="font-medium">Already checked in</div>
            {reg.checked_in_at && <div className="mt-0.5">Checked in {formatDateTime(reg.checked_in_at)}</div>}
            {reg.checked_in_by && <div className="text-indigo-600">by staff</div>}
          </div>
        </div>
      )}

      {/* Same ticket UI as the attendee ticket page */}
      <TicketCard reg={reg} event={event} guest={guest} />

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline"><Link to={`/tickets/${reg.id}`}><TicketIcon className="w-4 h-4 mr-1.5" /> View ticket</Link></Button>
        {event && <Button asChild variant="outline"><Link to={`/admin/events/${event.id}/registrations`} target="_blank"><ExternalLink className="w-4 h-4 mr-1.5" /> Event registrations</Link></Button>}
        {reg.status !== "checked_in" && reg.status !== "cancelled" && (
          <Button onClick={checkIn} disabled={busy}><UserCheck className="w-4 h-4 mr-1.5" /> Check in</Button>
        )}
        {reg.status === "checked_in" && (
          <Button onClick={undoCheckIn} disabled={busy} variant="outline"><Undo2 className="w-4 h-4 mr-1.5" /> Undo check-in</Button>
        )}
        {reg.status !== "cancelled" && reg.status !== "checked_in" && (
          <Button onClick={cancel} disabled={busy} variant="ghost" className="text-rose-600 hover:text-rose-700"><Ban className="w-4 h-4 mr-1.5" /> Cancel</Button>
        )}
        {reg.status === "cancelled" && (
          <Button onClick={restore} disabled={busy} variant="outline"><Undo2 className="w-4 h-4 mr-1.5" /> Restore</Button>
        )}
      </div>
      {ConfirmDialog}
    </div>
  );
}
