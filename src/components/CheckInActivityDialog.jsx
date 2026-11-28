import { db } from "@/api/db";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/event-utils";
import { CHECKIN_METHOD_LABELS } from "@/lib/checkin";
import { Search } from "lucide-react";

export default function CheckInActivityDialog({ open, onOpenChange, eventId, eventName, regs = [] }) {
  const [tab, setTab] = useState("guests");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setLogs([]);
    setQuery("");
    setLoading(true);
    setError("");
    db.checkinLogs.list(eventId)
      .then((entries) => setLogs(entries || []))
      .catch((e) => setError(e?.message || "Could not load the scan log."))
      .finally(() => setLoading(false));
  }, [open, eventId]);

  const search = query.trim().toLowerCase();
  const matches = (item) => !search || [item.guest_name, item.guest_email, item.registration_number]
    .some((value) => String(value || "").toLowerCase().includes(search));
  const guests = regs
    .filter((reg) => reg.status === 'checked_in' && matches(reg))
    // @ts-ignore: Date subtraction coerces to numbers at runtime; checkJs rejects it.
    .sort((a, b) => new Date(b.checked_in_at) - new Date(a.checked_in_at));
  const visibleLogs = logs.filter(matches);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Check-in activity — {eventName || "event"}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email or registration no."
            className="pl-9"
          />
        </div>

        <div className="flex gap-2" role="tablist" aria-label="Check-in activity">
          <Button
            type="button"
            role="tab"
            aria-selected={tab === "guests"}
            size="sm"
            variant={tab === "guests" ? "default" : "outline"}
            onClick={() => setTab("guests")}
          >
            Checked-in guests
          </Button>
          <Button
            type="button"
            role="tab"
            aria-selected={tab === "logs"}
            size="sm"
            variant={tab === "logs" ? "default" : "outline"}
            onClick={() => setTab("logs")}
          >
            Scan log
          </Button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto" role="tabpanel">
          {tab === "guests" ? (
            guests.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">{search ? "No matching checked-in guests" : "No checked-in guests yet"}</p>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border">
                {guests.map((reg) => (
                  <div key={reg.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{reg.guest_name || reg.guest_email || "Unknown guest"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {reg.guest_name && reg.guest_email ? reg.guest_email : reg.registration_number || "—"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {reg.registration_number ? `${reg.registration_number} · ` : ""}{formatDateTime(reg.checked_in_at)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium">
                      {CHECKIN_METHOD_LABELS[reg.check_in_method] || CHECKIN_METHOD_LABELS.manual_button}
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-3">
              {loading && <p className="py-6 text-center text-sm text-muted-foreground">Loading scan log…</p>}
              {error && (
                <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {error}
                </p>
              )}
              {!loading && !error && visibleLogs.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">{search ? "No matching scans" : "No scans recorded yet"}</p>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border">
                  {visibleLogs.map((log) => (
                    <div key={log.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{log.guest_name || log.guest_email || "Unknown guest"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {log.guest_name && log.guest_email ? log.guest_email : log.registration_number || "—"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {log.registration_number ? `${log.registration_number} · ` : ""}{formatDateTime(log.created_date)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium">
                          {CHECKIN_METHOD_LABELS[log.method] || log.method || "—"}
                        </span>
                        {log.already && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            Already in
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
