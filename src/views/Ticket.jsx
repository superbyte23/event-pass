import { db } from "@/api/db";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "@/lib/AuthContext";
import SiteNav from "@/components/SiteNav";
import TicketCard from "@/components/TicketCard";
import { ForbiddenPage, NotFoundPage, ServerErrorPage, UnauthorizedPage } from "@/components/ErrorPage";
import { Button } from "@/components/ui/button";
import { resolveAttendeeProfile } from "@/lib/attendee";
import { formatDate } from "@/lib/event-utils";
import { Loader2, Printer, ArrowLeft, CheckCircle2, Download } from "lucide-react";

export default function Ticket() {
  const { registration } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reg, setReg] = useState(undefined);
  const [event, setEvent] = useState(undefined);
  const [guest, setGuest] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [downloading, setDownloading] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [searchParams] = useSearchParams();
  const autoDownloadedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    setReg(undefined);
    setEvent(undefined);
    setLoadError(null);
    (async () => {
      try {
        const r = await db.entities.Registration.get(registration);
        if (!alive) return;
        setReg(r);
        // Guest tickets resolve to the account photo when the guest email
        // belongs to a user (admins can read any user; guests only their own).
        const profile = await resolveAttendeeProfile(r, user).catch(() => null);
        if (alive) setGuest(profile);
        try {
          const e = await db.entities.Event.get(r.event_id);
          if (alive) setEvent(e);
        } catch { if (alive) setEvent(null); }
      } catch (error) {
        if (alive) {
          setReg(null);
          setLoadError(error);
        }
      }
    })();
    return () => { alive = false; };
  }, [registration, user, reloadKey]);

  const handleDownload = useCallback(async (format) => {
    if (!reg?.id || downloading) return;
    setDownloading(format);
    setDownloadError("");
    try {
      const blob = await db.tickets.downloadImage(reg.id, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ticket-${reg.registration_number || reg.id}.${format === "jpeg" ? "jpg" : "webp"}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(error?.message || "Could not download the ticket image.");
    } finally {
      setDownloading("");
    }
  }, [reg?.id, reg?.registration_number, downloading]);

  useEffect(() => {
    if (
      searchParams.get("download") !== "1" ||
      !reg?.id ||
      autoDownloadedRef.current ||
      downloading
    ) return;
    autoDownloadedRef.current = true;
    handleDownload("webp");
  }, [searchParams, reg?.id, downloading, handleDownload]);

  if (reg === undefined || (reg && event === undefined)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Ticket links require an account, but a failed load is still reported by
  // status instead of collapsing every failure into "not found".
  if (loadError || reg === null) {
    const status = loadError?.status;
    if (status === 401) {
      return (
        <UnauthorizedPage
          title="Sign in to view this ticket"
          description="This ticket is tied to a signed-in session. Sign in and we'll bring you straight back to it."
          returnTo={`/tickets/${registration}`}
        />
      );
    }
    if (status === 403) {
      return (
        <ForbiddenPage
          title="You can't view this ticket"
          description="You don't have access to this registration. Check the link, or sign in with the account used to register."
        />
      );
    }
    if (status === 404 || reg === null) {
      return (
        <NotFoundPage
          title="Ticket not found"
          description="This ticket may have been cancelled, or the link might be incomplete. You can look up guest tickets with the email or name you registered with."
        />
      );
    }
    return (
      <ServerErrorPage
        title="We couldn't load this ticket"
        description="Something went wrong while fetching your ticket. Please try again."
        onRetry={() => setReloadKey((key) => key + 1)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <SiteNav />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        {reg.status === "checked_in" && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-800">
            <CheckCircle2 className="w-5 h-5 shrink-0" /> Checked in{reg.checked_in_at ? ` · ${formatDate(reg.checked_in_at)}` : ""}
          </div>
        )}

        <TicketCard reg={reg} event={event} guest={guest} />

        {/* Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 print:hidden">
          <Button variant="outline" onClick={() => navigate(user ? "/my-events" : "/events")}><ArrowLeft className="w-4 h-4 mr-1.5" /> {user ? "My tickets" : "Browse events"}</Button>
          <Button onClick={() => window.print()}><Printer className="w-4 h-4 mr-1.5" /> Print ticket</Button>
          <Button variant="outline" onClick={() => handleDownload("webp")} disabled={Boolean(downloading)}>
            {downloading === "webp" ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />} Download WebP
          </Button>
          <Button variant="outline" onClick={() => handleDownload("jpeg")} disabled={Boolean(downloading)}>
            {downloading === "jpeg" ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />} Download JPEG
          </Button>
        </div>
        {downloadError && (
          <p className="mt-3 text-center text-sm text-rose-600 print:hidden">{downloadError}</p>
        )}
        <p className="mt-4 text-center text-xs text-slate-400 print:hidden">
          Downloads are high-resolution 4 × 6 portrait images. Keep this ticket on your phone — the QR code is unique to your registration.
        </p>
      </div>
    </div>
  );
}
