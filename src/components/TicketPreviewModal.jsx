import { useEffect } from "react";

import TicketCard from "@/components/TicketCard";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/event-utils";
import { CheckCheck, X } from "lucide-react";

// Admin-side preview of the ticket attendees see, without leaving the admin page.
export default function TicketPreviewModal({ reg, event, guest, onClose, footer = undefined }) {
  useEffect(() => {
    if (!reg) return;
    const onKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [reg, onClose]);

  if (!reg) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ticket preview"
        className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-black/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pretty-scrollbar max-h-[92vh] overflow-y-auto p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ticket preview</p>
              <p className="font-mono text-sm">{reg.registration_number}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close ticket preview" className="text-muted-foreground hover:bg-slate-100 hover:text-slate-900">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {reg.status === "checked_in" && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-800">
              <CheckCheck className="w-5 h-5 shrink-0" />
              Checked in{reg.checked_in_at ? ` · ${formatDateTime(reg.checked_in_at)}` : ""}
            </div>
          )}

          <TicketCard reg={reg} event={event} guest={guest} />

          {footer && <div className="mt-4">{footer}</div>}

          <p className="mt-3 text-center text-xs text-muted-foreground">This is the ticket attendees see. Its QR code works offline.</p>
        </div>
      </div>
    </div>
  );
}
