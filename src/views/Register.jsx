import { db } from "@/api/db";

import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

import { useAuth } from "@/lib/AuthContext";
import SiteNav from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Image } from "@/components/ui/image";
import { EventStatusBadge } from "@/components/StatusBadge";
import GoogleIcon from "@/components/GoogleIcon";
import FormRenderer from "@/components/FormRenderer";
import GuestRegisterForm from "@/components/GuestRegisterForm";
import { registrationAvailability, formatDate, timeRangeLabel } from "@/lib/event-utils";
import { registerForEvent, getMyRegistrationForEvent } from "@/lib/registration";
import { Loader2, CalendarDays, Clock, MapPin, AlertCircle, Ticket as TicketIcon } from "lucide-react";

export default function Register() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, googleAuthEnabled } = useAuth();
  const googleMode = googleAuthEnabled !== false;
  const [event, setEvent] = useState(undefined);
  const [checking, setChecking] = useState(true);
  const [responses, setResponses] = useState({});
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const submittingRef = useRef(false);

  useEffect(() => {
    setEvent(undefined);
    db.entities.Event.filter({ slug })
      .then((list) => setEvent(list && list[0] ? list[0] : null))
      .catch(() => setEvent(null));
  }, [slug]);

  useEffect(() => {
    if (!event || !googleMode || !isAuthenticated) return;
    setChecking(true);
    getMyRegistrationForEvent(event.id, user?.id)
      .then((r) => {
        if (r) navigate(`/tickets/${r.id}`, { replace: true });
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [event, isAuthenticated]);

  const availability = event ? registrationAvailability(event, null) : null;

  const signIn = () => {
    const dest = `${window.location.pathname}${window.location.search}`;
    if (db.auth.loginWithProvider) {
      db.auth.loginWithProvider("google", dest).catch(() => db.auth.redirectToLogin(dest));
    } else db.auth.redirectToLogin(dest);
  };

  const onFieldChange = (id, val) => setResponses((r) => ({ ...r, [id]: val }));

  const validate = () => {
    const e = {};
    (event.form_fields || []).forEach((f) => {
      if (f.required) {
        const v = responses[f.id];
        if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) e[f.id] = "This field is required.";
      }
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return; // guard against double-submit races
    if (!event || !user) return;
    if (!validate()) return;
    submittingRef.current = true;
    setStatus("registering");
    setError("");
    try {
      const res = await registerForEvent(event, user, responses);
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

  if (event === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (event === null) {
    return (
      <div className="min-h-screen bg-background">
        <SiteNav />
        <div className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="text-3xl font-semibold">Event not found</h1>
          <p className="mt-2 text-muted-foreground">This event may have been removed or is no longer public.</p>
          <Button asChild className="mt-6"><Link to="/events">Browse events</Link></Button>
        </div>
      </div>
    );
  }

  const accent = event.accent_color || "#0f172a";
  const fields = event.form_fields || [];

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-center gap-4">
          {event.logo ? (
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-white">
              <Image src={event.logo} fittingType="fill" className="h-full w-full object-contain" />
            </div>
          ) : null}
          <div className="min-w-0">
            <EventStatusBadge status={event.status} />
            <h1 className="mt-1.5 truncate text-xl font-bold tracking-tight sm:text-2xl">{event.name}</h1>
          </div>
        </div>

        <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
          <div className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> {formatDate(event.date)}</div>
          <div className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {timeRangeLabel(event.start_time, event.end_time) || "—"}</div>
          <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {event.venue || "—"}</div>
        </div>

        {availability && !availability.canRegister ? (
          <Card className="mt-6 p-6 text-center">
            <AlertCircle className="mx-auto w-8 h-8 text-muted-foreground" />
            <p className="mt-3 font-medium">{availability.reason}</p>
            <Button asChild variant="outline" className="mt-4"><Link to={`/events/${event.slug}`}>Back to event</Link></Button>
          </Card>
        ) : !googleMode ? (
          <GuestRegisterForm event={event} />
        ) : !isAuthenticated ? (
          <Card className="mt-6 p-6 sm:p-8">
            <div className="text-center">
              <h2 className="text-lg font-semibold">Sign in to register</h2>
              <p className="mt-1 text-sm text-muted-foreground">You'll sign in with Google to secure your spot — one account, one guest per event.</p>
              <Button onClick={signIn} size="lg" className="mt-5 w-full sm:w-auto" style={{ backgroundColor: accent }}>
                <GoogleIcon className="w-5 h-5 mr-2" /> Continue with Google
              </Button>
            </div>
          </Card>
        ) : checking ? (
          <div className="mt-10 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <form onSubmit={submit} className="mt-6">
            <Card className="p-6 sm:p-8">
              <h2 className="text-lg font-semibold">Your details</h2>
              <p className="mt-1 text-sm text-muted-foreground">Fill in the form below to complete your registration.</p>
              <div className="mt-5">
                {fields.length > 0 ? (
                  <FormRenderer fields={fields} responses={responses} onFieldChange={onFieldChange} errors={errors} />
                ) : (
                  <p className="text-sm text-muted-foreground">Confirm your registration to receive your ticket.</p>
                )}
              </div>

              {error && (
                <div className="mt-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
                  <AlertCircle className="mt-0.5 w-5 h-5 shrink-0" />
                  <div className="text-sm">{error}</div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Signed in as {user?.email}</p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => navigate(`/events/${event.slug}`)}>Cancel</Button>
                  <Button type="submit" disabled={status === "registering"} style={{ backgroundColor: accent }}>
                    {status === "registering" ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Registering…</> : <><TicketIcon className="w-4 h-4 mr-1.5" /> Complete registration</>}
                  </Button>
                </div>
              </div>
            </Card>
          </form>
        )}
      </div>
    </div>
  );
}