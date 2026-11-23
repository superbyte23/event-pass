import { db } from "@/api/db";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Power,
  Send,
  Star,
  Trash2,
  Upload,
} from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY_FORM = {
  label: "",
  email: "",
  from: "",
  password: "",
  daily_limit: 500,
  shared_with_admins: false,
};

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

export default function AdminMailAccounts() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [credentialsKeyConfigured, setCredentialsKeyConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState({ id: null, action: null });
  const [testAccount, setTestAccount] = useState(null);
  const [testForm, setTestForm] = useState({ to: "", subject: "", body: "" });
  const [testSending, setTestSending] = useState(false);
  const [testError, setTestError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await db.admin.mailAccounts.list();
      setAccounts(Array.isArray(data?.accounts) ? data.accounts : []);
      setCredentialsKeyConfigured(data?.credentialsKeyConfigured !== false);
    } catch (e) {
      setLoadError(e?.message || "Could not load mail accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError("");
  };

  const openTestDialog = (account) => {
    setTestAccount(account);
    setTestForm({
      to: user?.email || "",
      subject: "Your ticket for 12th Educators Congress (Sample)",
      body: "",
    });
    setTestError("");
  };

  const closeTestDialog = () => {
    setTestAccount(null);
    setTestError("");
  };

  const closeImportDialog = () => {
    setImportOpen(false);
    setImportFile(null);
    setImportError("");
    setImportResult(null);
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const data = await db.admin.mailAccounts.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mail-accounts-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast({
        title: "Mail accounts exported",
        description: "Keep the file private — App Passwords are included in encrypted form.",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Export failed",
        description: e?.message || "Could not export mail accounts.",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event) => {
    event.preventDefault();
    if (!importFile) {
      setImportError("Choose a mail-account export JSON file first.");
      return;
    }

    setImporting(true);
    setImportError("");
    setImportResult(null);
    try {
      const text = await importFile.text();
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error("The selected file is not valid JSON.");
      }
      if (payload?.format && payload.format !== "eventpass-mail-accounts") {
        throw new Error("This is not an EventPass mail-account export.");
      }

      const result = await db.admin.mailAccounts.importData(payload, { updateExisting });
      setImportResult(result);
      toast({
        title: "Import finished",
        description: `${result.created} created · ${result.updated} updated · ${result.skipped} skipped · ${result.failed} failed`,
      });
      await load();
    } catch (e) {
      const message = e?.message || "Could not import mail accounts.";
      setImportError(message);
      toast({ variant: "destructive", title: "Import failed", description: message });
    } finally {
      setImporting(false);
    }
  };

  const sendTest = async (event) => {
    event.preventDefault();
    const to = testForm.to.trim().toLowerCase();
    if (!EMAIL_RE.test(to)) {
      setTestError("Enter a valid recipient email address.");
      return;
    }
    if (!testForm.subject.trim()) {
      setTestError("Subject is required.");
      return;
    }

    setTestSending(true);
    setTestError("");
    try {
      await db.admin.mailAccounts.test(testAccount.id, {
        to,
        subject: testForm.subject.trim(),
        body: testForm.body,
      });
      toast({ title: "Sample ticket sent", description: `Delivered to ${to}.` });
      closeTestDialog();
      await load();
    } catch (e) {
      const message = e?.message || "Could not send the test email.";
      setTestError(message);
      toast({ variant: "destructive", title: "Test failed", description: message });
    } finally {
      setTestSending(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (!form.label.trim()) {
      setFormError("Label is required.");
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setFormError("Enter a valid Gmail address.");
      return;
    }
    if (!editingId && !form.password.trim()) {
      setFormError("Gmail App Password is required.");
      return;
    }

    const payload = {
      label: form.label.trim(),
      email,
      from: form.from.trim() || `EventPass <${email}>`,
      daily_limit: Number(form.daily_limit) || 500,
      shared_with_admins: Boolean(form.shared_with_admins),
      ...(form.password.trim() ? { password: form.password } : {}),
    };

    setSaving(true);
    setFormError("");
    try {
      if (editingId) {
        await db.admin.mailAccounts.update(editingId, payload);
        toast({ title: "Mail account updated" });
      } else {
        await db.admin.mailAccounts.create(payload);
        toast({ title: "Mail account added", description: `${email} is ready to send tickets.` });
      }
      resetForm();
      await load();
    } catch (e) {
      const message = e?.message || "Could not save the mail account.";
      setFormError(message);
      toast({ variant: "destructive", title: "Could not save", description: message });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (account) => {
    setEditingId(account.id);
    setForm({
      label: account.label,
      email: account.email,
      from: account.from,
      password: "",
      daily_limit: account.dailyLimit,
      shared_with_admins: account.sharedWithAdmins,
    });
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const runAction = async (account, action, handler, successTitle) => {
    setBusy({ id: account.id, action });
    try {
      await handler();
      if (successTitle) toast({ title: successTitle });
      await load();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Action failed",
        description: e?.message || "Please try again.",
      });
    } finally {
      setBusy({ id: null, action: null });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mail accounts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a Gmail account for each admin. App Passwords are encrypted and never shown again.
        </p>
      </div>

      {!credentialsKeyConfigured && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">MAIL_CREDENTIALS_KEY is not configured.</p>
              <p className="mt-1">
                Add it to <code>.env.local</code> and restart the dev server before saving an account.
                Generate one with:
              </p>
              <code className="mt-2 block overflow-x-auto rounded bg-amber-100 p-2 text-xs">
                node --input-type=module -e &quot;import &#123;randomBytes&#125; from &apos;node:crypto&apos;;
                console.log(randomBytes(32).toString(&apos;base64&apos;))&quot;
              </code>
            </div>
          </div>
        </div>
      )}

      <Card className="p-6">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </span>
          <div>
            <h2 className="text-base font-semibold">{editingId ? "Edit mail account" : "Add Gmail account"}</h2>
            <p className="text-sm text-muted-foreground">
              Uses smtp.gmail.com on port 587. Create a 16-character App Password after enabling 2FA.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mail-label">Label</Label>
            <Input
              id="mail-label"
              placeholder="Main Gmail"
              value={form.label}
              onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
              disabled={saving}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mail-email">Gmail address</Label>
            <Input
              id="mail-email"
              type="email"
              placeholder="you@gmail.com"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              disabled={saving}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mail-from">From address</Label>
            <Input
              id="mail-from"
              placeholder="EventPass <you@gmail.com>"
              value={form.from}
              onChange={(e) => setForm((p) => ({ ...p, from: e.target.value }))}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mail-password">
              {editingId ? "New App Password (optional)" : "Gmail App Password"}
            </Label>
            <Input
              id="mail-password"
              type="password"
              autoComplete="off"
              placeholder={editingId ? "Leave blank to keep current" : "16-character App Password"}
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              disabled={saving}
              required={!editingId}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mail-limit">Daily send limit</Label>
            <Input
              id="mail-limit"
              type="number"
              min={1}
              max={10000}
              value={form.daily_limit}
              onChange={(e) => setForm((p) => ({ ...p, daily_limit: e.target.value }))}
              disabled={saving}
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="mail-shared">Share with other admins</Label>
              <p className="mt-1 text-xs text-muted-foreground">Others can send, but cannot edit or delete it.</p>
            </div>
            <Switch
              id="mail-shared"
              checked={form.shared_with_admins}
              onCheckedChange={(checked) => setForm((p) => ({ ...p, shared_with_admins: checked }))}
              disabled={saving}
            />
          </div>

          {formError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 md:col-span-2">
              {formError}
            </div>
          )}

          <div className="flex items-center gap-3 md:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {saving ? "Saving…" : editingId ? "Save changes" : "Add account"}
            </Button>
            {editingId && (
              <Button type="button" variant="ghost" onClick={resetForm} disabled={saving}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-base font-semibold">Configured accounts</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportData}
              disabled={exporting || loading || accounts.length === 0}
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} disabled={importing}>
              <Upload className="h-4 w-4" /> Import
            </Button>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Refresh
            </Button>
          </div>
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
        ) : accounts.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No mail accounts yet. Add one above to start sending tickets.
          </div>
        ) : (
          <div className="grid gap-4 p-6 md:grid-cols-2">
            {accounts.map((account) => {
              const usedPercent = account.dailyLimit
                ? Math.min(100, Math.round((account.usedToday / account.dailyLimit) * 100))
                : 0;
              const isBusy = busy.id === account.id;
              return (
                <div key={account.id} className="rounded-xl border border-border p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{account.label}</h3>
                        {account.isDefault && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            <Star className="h-3 w-3" /> Default
                          </span>
                        )}
                        {account.sharedWithAdmins && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            Shared
                          </span>
                        )}
                        {!account.active && (
                          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-600">
                            Disabled
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm text-foreground">{account.email}</p>
                      <p className="truncate text-xs text-muted-foreground">From: {account.from}</p>
                    </div>
                    {account.canSend ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                    )}
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Daily quota</span>
                      <span>
                        {account.usedToday} / {account.dailyLimit} used · {account.remainingToday} left
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${usedPercent}%` }}
                      />
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground">Added {formatDate(account.createdDate)}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openTestDialog(account)}
                      disabled={isBusy || !account.canSend}
                    >
                      <Send className="h-4 w-4" />
                      Sample ticket
                    </Button>
                    {!account.isDefault && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          runAction(
                            account,
                            "default",
                            () => db.admin.mailAccounts.setDefault(account.id),
                            "Default mail account updated",
                          )
                        }
                        disabled={isBusy || !account.canSend}
                      >
                        {isBusy && busy.action === "default" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Star className="h-4 w-4" />
                        )}
                        Set default
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => startEdit(account)} disabled={isBusy}>
                      <Pencil className="h-4 w-4" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        runAction(
                          account,
                          "toggle",
                          () => db.admin.mailAccounts.update(account.id, { active: !account.active }),
                          account.active ? "Mail account disabled" : "Mail account enabled",
                        )
                      }
                      disabled={isBusy}
                    >
                      {isBusy && busy.action === "toggle" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Power className="h-4 w-4" />
                      )}
                      {account.active ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (!window.confirm(`Delete "${account.label}"? Sent history will be kept.`)) return;
                        runAction(account, "delete", () => db.admin.mailAccounts.remove(account.id), "Mail account deleted");
                      }}
                      disabled={isBusy}
                    >
                      {isBusy && busy.action === "delete" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog open={Boolean(testAccount)} onOpenChange={(open) => { if (!open) closeTestDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send sample ticket email</DialogTitle>
            <DialogDescription>
              From: <span className="font-medium text-foreground">{testAccount?.from || testAccount?.email}</span>
              <br />
              Sends a styled sample ticket with a QR code. Counts toward the daily quota.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={sendTest} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-to">To</Label>
              <Input
                id="test-to"
                type="email"
                placeholder="recipient@example.com"
                value={testForm.to}
                onChange={(e) => setTestForm((p) => ({ ...p, to: e.target.value }))}
                disabled={testSending}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-subject">Subject</Label>
              <Input
                id="test-subject"
                placeholder="Your ticket for 12th Educators Congress (Sample)"
                value={testForm.subject}
                onChange={(e) => setTestForm((p) => ({ ...p, subject: e.target.value }))}
                disabled={testSending}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-body">Note (optional)</Label>
              <Textarea
                id="test-body"
                rows={4}
                placeholder="Add a short note shown on the sample ticket…"
                value={testForm.body}
                onChange={(e) => setTestForm((p) => ({ ...p, body: e.target.value }))}
                disabled={testSending}
              />
              <p className="text-xs text-muted-foreground">
                The rest of the email body is a pre-designed sample event ticket.
              </p>
            </div>
            {testError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {testError}
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeTestDialog} disabled={testSending}>
                Cancel
              </Button>
              <Button type="submit" disabled={testSending}>
                {testSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {testSending ? "Sending…" : "Send sample ticket"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={(open) => { if (!open) closeImportDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import mail accounts</DialogTitle>
            <DialogDescription>
              Import an EventPass JSON export. Encrypted App Passwords are restored only when this deployment
              uses the same <code>MAIL_CREDENTIALS_KEY</code>; otherwise re-enter them after import.
              Imported accounts are assigned to you.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleImport} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mail-import-file">Export JSON file</Label>
              <Input
                id="mail-import-file"
                type="file"
                accept="application/json,.json"
                onChange={(e) => {
                  setImportFile(e.target.files?.[0] || null);
                  setImportError("");
                  setImportResult(null);
                }}
                disabled={importing}
              />
            </div>
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="mail-import-update">Update existing accounts</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Replace settings when an email already exists. Otherwise duplicates are skipped.
                </p>
              </div>
              <Switch
                id="mail-import-update"
                checked={updateExisting}
                onCheckedChange={setUpdateExisting}
                disabled={importing}
              />
            </div>

            {importError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {importError}
              </div>
            )}

            {importResult && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <p className="font-medium">
                  {importResult.created} created · {importResult.updated} updated ·{" "}
                  {importResult.skipped} skipped · {importResult.failed} failed
                </p>
                {importResult.warning && (
                  <p className="mt-2 text-amber-700">{importResult.warning}</p>
                )}
                {importResult.results.length > 0 && (
                  <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                    {importResult.results.slice(0, 20).map((result, index) => (
                      <li key={`${result.email || result.label}-${index}`}>
                        <span className="font-medium uppercase">{result.status}</span>{" "}
                        {result.label || result.email || `Row ${index + 1}`}
                        {result.reason ? ` — ${result.reason}` : ""}
                      </li>
                    ))}
                    {importResult.results.length > 20 && (
                      <li>…and {importResult.results.length - 20} more</li>
                    )}
                  </ul>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeImportDialog} disabled={importing}>
                Close
              </Button>
              <Button type="submit" disabled={importing || !importFile}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {importing ? "Importing…" : "Import accounts"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
