import { db } from "@/api/db";

import { useCallback, useEffect, useState } from "react";

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
import { AlertCircle, Crown, Loader2, Trash2, UserPlus, Users } from "lucide-react";

function adminLabel(admin) {
  if (!admin) return "Unknown admin";
  return admin.fullName ? `${admin.fullName} (${admin.email})` : admin.email || "Unknown admin";
}

function AdminOption({ admin }) {
  const name = admin.fullName || admin.email || "Unknown admin";
  const email = admin.email || "No email";
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-foreground">{name}</p>
      {admin.fullName && admin.email ? (
        <p className="truncate text-xs text-muted-foreground">{email}</p>
      ) : null}
    </div>
  );
}

export default function EventAdminsDialog({ eventId, open, onOpenChange, onChanged }) {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedAdmins, setSelectedAdmins] = useState([]);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError("");
    try {
      const result = await db.admin.eventAdmins.list(eventId);
      setData(result);
      setSelectedAdmins([]);
    } catch (e) {
      const message = e?.message || "Could not load linked admins.";
      setError(message);
      toast({ variant: "destructive", title: "Could not load admins", description: message });
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    if (open && eventId) load();
  }, [open, eventId, load]);

  const finish = async (action) => {
    await load();
    onChanged?.();
    toast({ title: action === "add" ? "Admin linked" : "Admin unlinked" });
  };

  const handleAdd = async () => {
    if (selectedAdmins.length === 0) return;
    setBusy("add");
    setError("");
    const results = await Promise.allSettled(
      selectedAdmins.map((adminId) => db.admin.eventAdmins.add(eventId, { adminId })),
    );
    const failed = results.filter((result) => result.status === "rejected");
    const succeeded = results.length - failed.length;

    if (succeeded > 0) {
      await load();
      onChanged?.();
      setSelectedAdmins([]);
      toast({
        title: succeeded === 1 ? "Admin linked" : `${succeeded} admins linked`,
        description:
          failed.length > 0
            ? `${failed.length} admin${failed.length === 1 ? "" : "s"} could not be linked.`
            : undefined,
      });
    }

    if (failed.length > 0) {
      const message = failed[0].reason?.message || "Could not link selected admins.";
      setError(message);
      if (succeeded === 0) {
        toast({ variant: "destructive", title: "Could not link admins", description: message });
      }
    }

    setBusy(null);
  };

  const handleRemove = async (admin) => {
    setBusy(admin.id);
    setError("");
    try {
      await db.admin.eventAdmins.remove(eventId, admin.id);
      await finish("remove");
    } catch (e) {
      const message = e?.message || "Could not unlink this admin.";
      setError(message);
      toast({ variant: "destructive", title: "Could not unlink admin", description: message });
    } finally {
      setBusy(null);
    }
  };

  const available = data?.availableAdmins || [];
  const linked = data?.linked || [];
  const canManage = Boolean(data?.canManage);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Linked admins
          </DialogTitle>
          <DialogDescription>
            {data?.eventName ? `${data.eventName} — ` : ""}Linked admins can view and manage this
            event even while it is unpublished.
          </DialogDescription>
        </DialogHeader>

        {loading && !data ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="min-w-0 space-y-5 overflow-hidden">
            <div className="min-w-0">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Event owner
              </p>
              {data?.owner ? (
                <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
                  <Crown className="h-4 w-4 shrink-0 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={adminLabel(data.owner)}>
                      {data.owner.fullName || data.owner.email || "Unknown admin"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {data.owner.fullName && data.owner.email
                        ? data.owner.email
                        : "Owner — always has access"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                  This event has no owner. Any admin can manage its links.
                </p>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Linked admins ({linked.length})
              </p>
              {linked.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  No other admins are linked yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {linked.map((admin) => (
                    <div
                      key={admin.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" title={adminLabel(admin)}>
                          {admin.fullName || admin.email || "Unknown admin"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {admin.fullName && admin.email ? admin.email : "Can view and manage"}
                        </p>
                      </div>
                      {canManage && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-600 hover:text-rose-700"
                          onClick={() => handleRemove(admin)}
                          disabled={Boolean(busy)}
                          title={`Unlink ${adminLabel(admin)}`}
                        >
                          {busy === admin.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {canManage ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Link another admin
                </p>
                {available.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    All admin accounts are already linked.
                  </p>
                ) : (
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                    <div className="min-w-0 sm:flex-1">
                      <Select multiple value={selectedAdmins} onValueChange={setSelectedAdmins}>
                        <SelectTrigger className="w-full min-w-0">
                          <SelectValue placeholder="Choose admins" />
                        </SelectTrigger>
                        <SelectContent>
                          {available.map((admin) => (
                            <SelectItem
                              key={admin.id}
                              value={admin.id}
                              label={adminLabel(admin)}
                              className="items-start py-2"
                            >
                              <AdminOption admin={admin} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      className="sm:shrink-0"
                      onClick={handleAdd}
                      disabled={selectedAdmins.length === 0 || Boolean(busy)}
                    >
                      {busy === "add" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4" />
                      )}
                      Link {selectedAdmins.length > 1 ? `(${selectedAdmins.length})` : ""}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                Only the event owner can change linked admins.
              </p>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange?.(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
