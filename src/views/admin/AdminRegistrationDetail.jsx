import { db } from "@/api/db";

import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";

import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RegStatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/event-utils";
import { ArrowLeft, Ticket as TicketIcon, UserCheck, Undo2, Ban, ExternalLink } from "lucide-react";

export default function AdminRegistrationDetail() {
  const { registration } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reg, setReg] = useState(undefined);
  const [event, setEvent] = useState(null);
  const [guest, setGuest] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    db.entities.Registration.get(registration).then(async (r) => {
      setReg(r);
      try { setEvent(await db.entities.Event.get(r.event_id)); } catch { setEvent(null); }
      try {
        if (r.user_id) setGuest(await db.entities.User.get(r.user_id));
        else setGuest({ full_name: r.guest_name, email: r.guest_email, image: null });
      } catch { setGuest(null); }
    }).catch(() => setReg(null));
  };
  useEffect(() => { load(); }, [registration]);

  const update = async (data) => {
    setBusy(true);
    try { await db.entities.Registration.update(reg.id, data); load(); } finally { setBusy(false); }
  };
  const checkIn = () => update({ status: "checked_in", checked_in_at: new Date().toISOString(), checked_in_by: user?.id });
  const undoCheckIn = () => update({ status: "confirmed", checked_in_at: null, checked_in_by: null });
  const cancel = async () => { if (confirm("Cancel this registration?")) update({ status: "cancelled" }); };
  const restore = () => update({ status: "confirmed" });

  if (reg === undefined) return <div className="flex h-64 items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  if (reg === null) return <div className="py-20 text-center text-muted-foreground">Registration not found. <Link to="/admin/events" className="text-primary hover:underline">Back</Link></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => history.back()}><ArrowLeft className="w-4 h-4 mr-1.5" /> Back</Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-mono">{reg.registration_number}</h1>
          <p className="text-sm text-muted-foreground">{event?.name || reg.event_name}</p>
        </div>
        <RegStatusBadge status={reg.status} />
      </div>

      {reg.status === "checked_in" && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
          <div className="font-medium">Already checked in</div>
          {reg.checked_in_at && <div className="mt-0.5">Checked in {formatDateTime(reg.checked_in_at)}</div>}
          {reg.checked_in_by && <div className="text-indigo-600">by staff</div>}
        </div>
      )}

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Guest</h2>
        <div className="flex items-center gap-4">
          {guest?.image ? <img src={guest.image} alt="" className="h-14 w-14 rounded-full object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">{(guest?.full_name || "?").charAt(0)}</span>}
          <div>
            <div className="font-semibold">{guest?.full_name || "Unknown guest"}</div>
            <div className="text-sm text-muted-foreground">{guest?.email || ""}</div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Registration</h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Registration no.</dt><dd className="mt-0.5 font-mono font-medium">{reg.registration_number}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt><dd className="mt-0.5"><RegStatusBadge status={reg.status} /></dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Registered</dt><dd className="mt-0.5">{reg.created_date ? formatDateTime(reg.created_date) : "—"}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Checked in</dt><dd className="mt-0.5">{reg.checked_in_at ? formatDateTime(reg.checked_in_at) : "—"}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">QR token</dt><dd className="mt-0.5 font-mono text-xs break-all">{reg.qr_token}</dd></div>
        </dl>
      </Card>

      {event?.form_fields?.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Registration details</h2>
          <dl className="space-y-3">
            {event.form_fields.map((f) => {
              const val = reg.responses?.[f.id];
              const display = Array.isArray(val) ? val.join(", ") : (val || "—");
              return (
                <div key={f.id}>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">{f.label}</dt>
                  <dd className="mt-0.5 text-sm whitespace-pre-line">{display}</dd>
                </div>
              );
            })}
          </dl>
        </Card>
      )}

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
    </div>
  );
}