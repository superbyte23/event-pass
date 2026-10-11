import { useEffect, useState } from "react";

import SiteNav from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import CheckInResult from "@/components/CheckInResult";
import { checkInByQrValue } from "@/lib/checkin";
import { Link, useParams } from "react-router-dom";
import { ScanLine } from "lucide-react";

export default function CheckInUrl() {
  const { qrToken } = useParams();
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!qrToken) return;
    let alive = true;
    setBusy(true);
    checkInByQrValue(qrToken)
      .then((data) => {
        if (alive) setResult(data);
      })
      .catch((e) => {
        if (alive) setError(e?.message || "Check-in failed.");
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [qrToken]);

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <ScanLine className="h-5 w-5" /> Staff check-in
          </h1>
          <div className="mt-4">
            <CheckInResult result={result} error={error} busy={busy} />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Opening a ticket QR link checks the attendee in. Repeating a scan reports "already checked in."
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link to="/admin/checkin">Open QR scanner</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}