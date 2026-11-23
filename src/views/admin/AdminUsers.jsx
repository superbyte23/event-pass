import { db } from "@/api/db";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Mail, ShieldCheck, UserPlus, Users } from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

export default function AdminUsers() {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({ email: "", full_name: "" });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const rows = await db.entities.User.filter({ role: "admin" }, "-created_date");
      setUsers(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setLoadError(e?.message || "Could not load admin accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const email = form.email.trim().toLowerCase();
    const full_name = form.full_name.trim();

    if (!EMAIL_RE.test(email)) {
      setFormError("Enter a valid email address.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      const created = await db.entities.User.create({
        email,
        full_name: full_name || null,
        role: "admin",
      });
      setForm({ email: "", full_name: "" });
      toast({
        title: "Admin account created",
        description: `${created.email} can now sign in with Google.`,
      });
      await loadUsers();
    } catch (e) {
      const message = e?.message || "Could not create the admin account.";
      setFormError(message);
      toast({ variant: "destructive", title: "Could not create admin", description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin accounts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create the accounts that can manage events, registrations, and ticket delivery.
        </p>
      </div>

      <Card className="p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserPlus className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Create admin account</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The new admin signs in with Google using this email. Shared-password sign-in still
              requires the email to be listed in <code>ADMIN_EMAILS</code>.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email address</Label>
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@example.com"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  disabled={submitting}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-name">Full name (optional)</Label>
                <Input
                  id="admin-name"
                  placeholder="Juan Dela Cruz"
                  value={form.full_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
                  disabled={submitting}
                />
              </div>

              {formError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 sm:col-span-2">
                  {formError}
                </div>
              )}

              <div className="flex items-center gap-3 sm:col-span-2">
                <Button type="submit" disabled={submitting || !form.email.trim()}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  {submitting ? "Creating…" : "Create admin"}
                </Button>
                <span className="text-xs text-muted-foreground">New accounts start with no mail configuration.</span>
              </div>
            </form>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-base font-semibold">Existing admins</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={loadUsers} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Refresh
          </Button>
        </div>

        {loadError && (
          <div className="m-6 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {loadError}
          </div>
        )}

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No admin accounts yet. Create one above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Account</th>
                  <th className="px-6 py-3 font-medium">Role</th>
                  <th className="px-6 py-3 font-medium">Mail configuration</th>
                  <th className="px-6 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{user.full_name || "Unnamed admin"}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        <ShieldCheck className="h-3.5 w-3.5" /> Admin
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        {user.default_mail_account_id ? "Configured" : "Not configured"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">{formatDate(user.created_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
