import { db } from "@/api/db";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  Send,
  SkipForward,
  XCircle,
} from "lucide-react";

const STATUS_META = {
  queued: { label: "Queued", className: "text-slate-500", dot: "bg-slate-300" },
  sending: { label: "Sending", className: "text-sky-600", dot: "bg-sky-500" },
  sent: { label: "Sent", className: "text-emerald-600", dot: "bg-emerald-500" },
  failed: { label: "Failed", className: "text-rose-600", dot: "bg-rose-500" },
  skipped: { label: "Skipped", className: "text-amber-600", dot: "bg-amber-500" },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function accountLabel(account) {
  if (!account) return "";
  return `${account.label || account.email} · ${account.email}`;
}

export default function BulkTicketEmailDialog({
  eventId,
  open,
  onOpenChange,
  registrationIds = [],
  onCompleted,
}) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [batch, setBatch] = useState(null);
  const [running, setRunning] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState("");
  const activeRef = useRef(false);

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    setError("");
    try {
      const result = await db.admin.mailAccounts.list();
      const all = Array.isArray(result) ? result : Array.isArray(result?.accounts) ? result.accounts : [];
      const usable = all.filter((account) => account.canSend && account.provider === "gmail");
      setAccounts(usable);
      const preferred = usable.find((account) => account.isDefault) || usable[0];
      setAccountId((current) => current || preferred?.id || "");
    } catch (e) {
      const message = e?.message || "Could not load Gmail accounts.";
      setError(message);
      toast({ variant: "destructive", title: "Mail accounts unavailable", description: message });
    } finally {
      setLoadingAccounts(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!open) {
      activeRef.current = false;
      return;
    }
    setBatch(null);
    setError("");
    loadAccounts();
  }, [open, loadAccounts]);

  const runBatch = useCallback(
    async (initial) => {
      activeRef.current = true;
      let current = initial;
      while (activeRef.current && current?.status === "running") {
        try {
          current = await db.admin.mailBatches.process(eventId, current.id);
          setBatch(current);
        } catch (e) {
          const message = e?.message || "The batch could not continue.";
          setError(message);
          setBatch((prev) => (prev ? { ...prev, status: "failed", error: message } : prev));
          break;
        }
        if (current.status !== "running") break;
        await sleep(400);
      }
      activeRef.current = false;
      setRunning(false);
      if (current && current.status !== "running") onCompleted?.();
    },
    [eventId, onCompleted],
  );

  // Poll while a chunk is being processed so "sending" is visible live.
  const batchId = batch?.id;
  const batchStatus = batch?.status;
  useEffect(() => {
    if (!open || !batchId || batchStatus !== "running") return undefined;
    const timer = setInterval(async () => {
      try {
        const fresh = await db.admin.mailBatches.get(eventId, batchId);
        if (!fresh) return;
        setBatch((prev) =>
          prev && prev.id === fresh.id
            ? {
                ...prev,
                status: fresh.status,
                processing: fresh.processing,
                counts: fresh.counts,
                items: fresh.items,
                error: fresh.error,
              }
            : prev,
        );
      } catch {
        // A failed poll is harmless; the process loop still updates state.
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [open, eventId, batchId, batchStatus]);

  const handleStart = async () => {
    if (!accountId || registrationIds.length === 0) return;
    setRunning(true);
    setError("");
    setBatch(null);
    try {
      const created = await db.admin.mailBatches.start(eventId, {
        accountId,
        registrationIds,
      });
      setBatch(created);
      await runBatch(created);
    } catch (e) {
      const message = e?.message || "Could not start the email batch.";
      setError(message);
      toast({ variant: "destructive", title: "Could not send tickets", description: message });
      setRunning(false);
    }
  };

  const handleCancel = async () => {
    if (!batch) return;
    setCanceling(true);
    try {
      const result = await db.admin.mailBatches.cancel(eventId, batch.id);
      activeRef.current = false;
      setBatch(result);
      setRunning(false);
      onCompleted?.();
    } catch (e) {
      const message = e?.message || "Could not cancel the batch.";
      setError(message);
    } finally {
      setCanceling(false);
    }
  };

  const selectedAccount = accounts.find((account) => account.id === accountId);
  const canStart = Boolean(accountId) && registrationIds.length > 0 && !running;
  const counts = batch?.counts || { total: 0, processed: 0, sent: 0, skipped: 0, failed: 0 };
  const progress = counts.total > 0 ? Math.round((counts.processed / counts.total) * 100) : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (running || canceling) return;
        onOpenChange?.(next);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Email tickets
          </DialogTitle>
          <DialogDescription>
            Send a ticket QR code to {registrationIds.length} selected registration
            {registrationIds.length === 1 ? "" : "s"}. Cancelled registrations and rows without an
            email are skipped automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!batch && (
            <>
              {loadingAccounts ? (
                <div className="flex h-20 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : accounts.length === 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <p className="font-medium">No Gmail account is ready to send.</p>
                  <p className="mt-1">
                    Add and verify a Gmail App Password in{" "}
                    <Link className="font-medium underline" to="/admin/mail-accounts" onClick={() => onOpenChange?.(false)}>
                      Mail accounts
                    </Link>
                    .
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Send from</label>
                  <Select value={accountId || undefined} onValueChange={setAccountId} disabled={running}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a Gmail account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {accountLabel(account)} — {account.remainingToday} left today
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedAccount && (
                    <p className="text-xs text-muted-foreground">
                      Daily limit {selectedAccount.dailyLimit} · used {selectedAccount.usedToday} ·{" "}
                      {selectedAccount.remainingToday} remaining
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {batch && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">
                    {batch.status === "completed"
                      ? "All done"
                      : batch.status === "cancelled"
                        ? "Cancelled"
                        : batch.status === "failed"
                          ? "Batch stopped"
                          : running || batch.processing
                            ? "Sending…"
                            : "Ready"}
                  </span>
                  <span className="text-muted-foreground">
                    {counts.processed} / {counts.total}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span className="text-emerald-600">Sent: {counts.sent}</span>
                  <span className="text-amber-600">Skipped: {counts.skipped}</span>
                  <span className="text-rose-600">Failed: {counts.failed}</span>
                  <span className="text-muted-foreground">
                    From: {batch.accountLabel || batch.accountEmail || selectedAccount?.email || "—"}
                  </span>
                </div>
              </div>

              {batch.error && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{batch.error}</span>
                </div>
              )}

              <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
                {batch.items.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">No registrations selected.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {batch.items.map((item) => {
                      const meta = STATUS_META[item.status] || STATUS_META.queued;
                      const Icon =
                        item.status === "sent"
                          ? CheckCircle2
                          : item.status === "failed"
                            ? XCircle
                            : item.status === "skipped"
                              ? SkipForward
                              : item.status === "sending"
                                ? Loader2
                                : Clock3;
                      return (
                        <div key={item.registrationId} className="flex items-start gap-3 px-3 py-2.5">
                          <Icon
                            className={`mt-0.5 h-4 w-4 shrink-0 ${meta.className} ${item.status === "sending" ? "animate-spin" : ""}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{item.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {item.email || "No email address"}
                            </p>
                            {(item.reason || item.skipReason) && (
                              <p className={`text-xs ${meta.className}`}>
                                {item.reason || item.skipReason}
                              </p>
                            )}
                          </div>
                          <span className={`shrink-0 text-xs font-medium ${meta.className}`}>
                            {meta.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {error && !batch && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          {batch?.status === "running" ? (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={canceling}>
                {canceling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel batch"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => onOpenChange?.(false)}
                disabled={running}
              >
                Close
              </Button>
              {!batch && (
                <Button onClick={handleStart} disabled={!canStart}>
                  {running ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send tickets
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
