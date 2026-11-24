import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Loader2, UserCheck } from "lucide-react";

const PHASE_META = {
  processing: {
    Icon: Loader2,
    title: "Scanning current ticket…",
    description: "QR captured — camera stays on. Keep scanning; the next code will be queued.",
    iconClass: "bg-primary/10 text-primary",
  },
  success: {
    Icon: CheckCircle2,
    title: "Check-in complete",
    description: "Camera is still on. The next queued scan will start automatically.",
    iconClass: "bg-emerald-100 text-emerald-700",
  },
  error: {
    Icon: AlertCircle,
    title: "Check-in failed",
    description: "Camera is still on. Queued scans will continue when you close this dialog.",
    iconClass: "bg-rose-100 text-rose-700",
  },
};

export default function CheckInProgressDialog({ scan = null, onContinue = undefined }) {
  const phase = scan?.phase || "processing";
  const meta = PHASE_META[phase] || PHASE_META.processing;
  const processing = phase === "processing";
  const already = !!scan?.result?.already;
  const registration = scan?.result?.registration;
  const queued = scan?.queued || 0;
  const Icon = phase === "success" && already ? UserCheck : meta.Icon;

  return (
    <Dialog
      open={Boolean(scan)}
      onOpenChange={(open) => {
        if (!open && !processing) onContinue?.();
      }}
    >
      <DialogContent
        className="max-w-md text-center sm:text-center"
        overlayClassName="bg-black/45"
        hideClose={processing}
        onEscapeKeyDown={(event) => {
          if (processing) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (processing) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (processing) event.preventDefault();
        }}
      >
        <DialogHeader className="items-center text-center">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-full", meta.iconClass)}>
            <Icon className={cn("h-6 w-6", processing && "animate-spin")} />
          </div>
          <DialogTitle>{already ? "Already checked in" : meta.title}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        {processing && (
          <div className="mt-2 space-y-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-full origin-left animate-pulse rounded-full bg-primary" />
            </div>
            <p className="truncate font-mono text-xs text-muted-foreground">{scan?.token}</p>
          </div>
        )}

        {phase === "success" && registration?.registration_number && (
          <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <span className="font-mono text-xs">{registration.registration_number}</span>
          </div>
        )}

        {phase === "error" && scan?.error && (
          <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {scan.error}
          </div>
        )}

        {scan?.notice && <p className="mt-2 text-xs text-amber-600">{scan.notice}</p>}

        {queued > 0 && (
          <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            {queued} more {queued === 1 ? "scan" : "scans"} queued — camera is still on.
          </p>
        )}

        {!processing && (
          <DialogFooter className="sm:justify-center">
            <Button onClick={onContinue}>{phase === "error" ? "Continue scanning" : "Done"}</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
