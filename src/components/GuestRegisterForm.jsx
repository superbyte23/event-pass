import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import FormRenderer from "@/components/FormRenderer";
import { registerGuestForEvent } from "@/lib/registration";
import { AlertCircle, Loader2, Ticket as TicketIcon } from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function GuestRegisterForm({ event }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [responses, setResponses] = useState({});
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const submittingRef = useRef(false);

  const accent = event.accent_color || "#0f172a";
  const fields = event.form_fields || [];

  const onFieldChange = (id, val) => setResponses((r) => ({ ...r, [id]: val }));

  const validate = () => {
    const e = {};
    if (!email.trim()) e.email = "Email is required.";
    else if (!EMAIL_RE.test(email.trim())) e.email = "Enter a valid email address.";
    (fields || []).forEach((f) => {
      if (f.required) {
        const v = responses[f.id];
        if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) e[f.id] = "This field is required.";
      }
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (submittingRef.current) return; // guard against double-submit races
    if (!validate()) return;
    submittingRef.current = true;
    setStatus("registering");
    setError("");
    try {
      const res = await registerGuestForEvent(event, { email: email.trim() }, responses);
      if ((res.success || res.already_registered) && res.registration) {
        navigate(`/tickets/${res.registration.id}`, { replace: true });
      } else {
        setStatus("error");
        setError(res.error || "Could not complete registration.");
      }
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Could not complete registration.");
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <form onSubmit={submit} className="mt-6">
      <Card className="p-6 sm:p-8">
        <h2 className="text-lg font-semibold">Your details</h2>
        <p className="mt-1 text-sm text-muted-foreground">Fill in the form below to get your ticket — one registration per email.</p>
        <div className="mt-5 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="guest-email">Email<span className="text-rose-500"> *</span></Label>
            <Input id="guest-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            {errors.email && <p className="text-xs text-rose-500">{errors.email}</p>}
            <p className="text-xs text-muted-foreground">Your ticket is linked to this email — one ticket per email per event.</p>
          </div>
          {fields.length > 0 && (
            <FormRenderer fields={fields} responses={responses} onFieldChange={onFieldChange} errors={errors} />
          )}
        </div>

        {error && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
            <AlertCircle className="mt-0.5 w-5 h-5 shrink-0" />
            <div className="text-sm">{error}</div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">No account needed — your ticket is linked to your email.</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(`/events/${event.slug}`)}>Cancel</Button>
            <Button type="submit" disabled={status === "registering"} style={{ backgroundColor: accent }}>
              {status === "registering" ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Registering…</> : <><TicketIcon className="w-4 h-4 mr-1.5" /> Complete registration</>}
            </Button>
          </div>
        </div>
      </Card>
    </form>
  );
}