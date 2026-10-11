import { db } from "@/api/db";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RegStatusBadge } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateShort, formatDateTime } from "@/lib/event-utils";
import { ArrowLeft, Search, Eye, Ticket as TicketIcon, ChevronLeft, ChevronRight, Download, Upload, Loader2, ScanLine } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const PAGE_SIZE = 10;

export default function AdminRegistrations() {
  const { event: eventId } = useParams();
  const [event, setEvent] = useState(undefined);
  const [regs, setRegs] = useState(null);
  const [users, setUsers] = useState({});
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState("date_desc");
  const [page, setPage] = useState(0);
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    db.entities.Event.get(eventId).then(setEvent).catch(() => setEvent(null));
    db.entities.Registration.filter({ event_id: eventId }).then((l) => setRegs(l || [])).catch(() => setRegs([]));
    db.entities.User.list("-created_date", 1000).then((l) => {
      const map = {};
      (l || []).forEach((u) => { map[u.id] = u; });
      setUsers(map);
    }).catch(() => setUsers({}));
  }, [eventId]);

  const rows = useMemo(() => {
    if (!regs) return null;
    let r = regs.map((reg) => ({ reg, user: users[reg.user_id] || { full_name: reg.guest_name, email: reg.guest_email } }));
    if (statusFilter !== "all") r = r.filter((x) => x.reg.status === statusFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter((x) =>
        x.reg.registration_number?.toLowerCase().includes(q) ||
        x.user?.full_name?.toLowerCase().includes(q) ||
        x.user?.email?.toLowerCase().includes(q)
      );
    }
    r.sort((a, b) => {
      if (sortKey === "date_desc") return new Date(b.reg.created_date) - new Date(a.reg.created_date);
      if (sortKey === "date_asc") return new Date(a.reg.created_date) - new Date(b.reg.created_date);
      if (sortKey === "number_asc") return a.reg.registration_number.localeCompare(b.reg.registration_number);
      if (sortKey === "name_asc") return (a.user?.full_name || "").localeCompare(b.user?.full_name || "");
      return 0;
    });
    return r;
  }, [regs, users, query, statusFilter, sortKey]);

  const pageCount = rows ? Math.max(1, Math.ceil(rows.length / PAGE_SIZE)) : 1;
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = rows ? rows.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE) : [];

  const exportCsv = () => {
    if (!rows) return;
    const header = ["Registration", "Name", "Email", "Registered", "Status", "Checked in"];
    const lines = rows.map((x) => [
      x.reg.registration_number,
      x.user?.full_name || "",
      x.user?.email || "",
      x.reg.created_date ? formatDateTime(x.reg.created_date) : "",
      x.reg.status,
      x.reg.checked_in_at ? formatDateTime(x.reg.checked_in_at) : "",
    ]);
    const csv = [header, ...lines].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${event?.slug || "registrations"}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const genToken = () => (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  const genNumber = () => `REG-${event?.date ? new Date(event.date).getFullYear() : new Date().getFullYear()}-${genToken().replace(/-/g, "").slice(0, 6).toUpperCase()}`;

  const parseCsv = (text) => {
    const rows = [];
    let row = [], field = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
        else field += c;
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ",") { row.push(field); field = ""; }
        else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
        else if (c === "\r") { /* skip */ }
        else field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((c) => String(c).trim()));
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) { toast({ variant: "destructive", title: "No rows found in file" }); return; }
      const first = rows[0].map((c) => String(c).trim().toLowerCase());
      const hasHeader = first.includes("name") || first.includes("email");
      const dataRows = hasHeader ? rows.slice(1) : rows;
      const existingEmails = new Set((regs || []).filter((r) => r.guest_email).map((r) => r.guest_email.toLowerCase()));
      const seen = new Set();
      const toCreate = [];
      let skipped = 0;
      for (const r of dataRows) {
        const name = (r[0] || "").trim();
        const email = (r[1] || "").trim().toLowerCase();
        if (!email) { skipped++; continue; }
        if (existingEmails.has(email) || seen.has(email)) { skipped++; continue; }
        seen.add(email);
        toCreate.push({
          event_id: event.id,
          event_name: event.name,
          guest_name: name,
          guest_email: email,
          registration_number: genNumber(),
          qr_token: genToken(),
          status: "confirmed",
          responses: {},
        });
      }
      if (toCreate.length > 0) await db.entities.Registration.bulkCreate(toCreate);
      const refreshed = await db.entities.Registration.filter({ event_id: eventId });
      setRegs(refreshed || []);
      setImportResult({ created: toCreate.length, skipped, total: dataRows.length });
      toast({ title: `Imported ${toCreate.length} attendee${toCreate.length === 1 ? "" : "s"}` });
    } catch (err) {
      toast({ variant: "destructive", title: "Import failed", description: err?.message });
    } finally {
      setImporting(false);
    }
  };

  if (event === undefined) return <div className="flex h-64 items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => history.back()}><ArrowLeft className="w-4 h-4 mr-1.5" /> Back</Button>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImport} />
          <Button size="sm" asChild><Link to="/admin/checkin"><ScanLine className="w-3.5 h-3.5 mr-1" /> Scan QR</Link></Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={importing || !event}>
            {importing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />} Import CSV
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows || rows.length === 0}><Download className="w-3.5 h-3.5 mr-1" /> Export CSV</Button>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Registrations</h1>
        <p className="text-sm text-muted-foreground">{event?.name} · {regs?.length || 0} total</p>
      </div>

      {importResult && (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
          Import complete: <span className="font-medium">{importResult.created}</span> added, <span className="font-medium">{importResult.skipped}</span> skipped (duplicates or missing email) of {importResult.total} rows.
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder="Search name, email or registration no." className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="checked_in">Checked in</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortKey} onValueChange={setSortKey}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="date_desc">Newest first</SelectItem>
            <SelectItem value="date_asc">Oldest first</SelectItem>
            <SelectItem value="number_asc">Registration no.</SelectItem>
            <SelectItem value="name_asc">Guest name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Registration</th>
                <th className="px-4 py-3 font-medium">Guest</th>
                <th className="px-4 py-3 font-medium">Registered</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Check-in</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows === null ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No registrations found.</td></tr>
              ) : pageRows.map(({ reg, user }) => (
                <tr key={reg.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{reg.registration_number}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{user?.full_name || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">{user?.email || ""}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{reg.created_date ? formatDateShort(reg.created_date) : "—"}</td>
                  <td className="px-4 py-3"><RegStatusBadge status={reg.status} /></td>
                  <td className="px-4 py-3 text-xs">{reg.checked_in_at ? formatDateTime(reg.checked_in_at) : <span className="text-muted-foreground">Not checked in</span>}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button asChild size="sm" variant="outline"><Link to={`/admin/registrations/${reg.id}`}><Eye className="w-3.5 h-3.5" /></Link></Button>
                      <Button asChild size="sm" variant="ghost"><Link to={`/tickets/${reg.id}`}><TicketIcon className="w-3.5 h-3.5" /></Link></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows && rows.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <span className="text-muted-foreground">Page {currentPage + 1} of {pageCount} · {rows.length} registrations</span>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="w-4 h-4" /></Button>
              <Button size="sm" variant="outline" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}