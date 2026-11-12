import { db } from "@/api/db";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RegStatusBadge } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fieldHasOptions, formatDateShort, formatDateTime, qrCheckinUrl } from "@/lib/event-utils";
import QRCode from "@/components/QRCode";
import { ArrowLeft, Search, Eye, Ticket as TicketIcon, ChevronLeft, ChevronRight, Download, Upload, Loader2, ScanLine, Trash2, CheckCheck, XCircle, RefreshCw, X, FileText } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/lib/AuthContext";

const PAGE_SIZE = 10;
const IMPORT_CHUNK_SIZE = 50;
const IMPORT_YIELD_EVERY = 25;

const IMPORT_ROW_STATUS = {
  pending: { label: "Pending", dot: "bg-muted-foreground/40", text: "text-muted-foreground" },
  saving: { label: "Saving", dot: "bg-sky-500", text: "text-sky-600" },
  success: { label: "Success", dot: "bg-emerald-500", text: "text-emerald-600" },
  skipped: { label: "Skipped", dot: "bg-amber-500", text: "text-amber-600" },
  failed: { label: "Failed", dot: "bg-rose-500", text: "text-rose-600" },
};

function FileUploadZone({ file, onFileSelect, onFileRemove, disabled, accept }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleFile = (file) => {
    if (!file) return;
    const accepted = (accept || "").split(',').map((ext) => ext.trim()).filter(Boolean);
    const matches = accepted.length === 0 || accepted.some(
      (ext) => file.name.toLowerCase().endsWith(ext.toLowerCase()) || file.type === ext,
    );
    if (!matches) return;
    onFileSelect(file);
  };

  const handleRemove = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onFileRemove();
  };

  if (file) {
    return (
      <div className="relative border-2 border-dashed border-primary/50 rounded-xl p-4 bg-primary/5 transition-all duration-200">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB • {file.type || 'CSV'}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleRemove}
            disabled={disabled}
            aria-label="Remove file"
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
          disabled ? 'border-muted bg-muted/50 cursor-not-allowed' :
          isDragOver ? 'border-primary bg-primary/5' :
          'border-muted/50 hover:border-primary/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileInputChange}
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={disabled}
          aria-label="Upload CSV file"
        />
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center transition-colors duration-200">
            <Upload className={`w-7 h-7 ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div className="text-center">
            <p className="font-medium text-sm">Drag & drop your CSV file here</p>
            <p className="text-xs text-muted-foreground">or click to browse</p>
            <p className="text-xs text-muted-foreground">Accepts: {accept}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminRegistrations() {
  const { event: eventId } = useParams();
  const [event, setEvent] = useState(undefined);
  const [regs, setRegs] = useState(null);
  const [users, setUsers] = useState({});
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fieldFilterId, setFieldFilterId] = useState("");
  const [fieldFilterValue, setFieldFilterValue] = useState("");
  const [sortKey, setSortKey] = useState("date_desc");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const { user } = useAuth();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importProgress, setImportProgress] = useState(null);
  const [importRows, setImportRows] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [modalAction, setModalAction] = useState(null); // 'checkin' | 'cancel'
  const [allowDuplicateEmails, setAllowDuplicateEmails] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);

  const openImportModal = () => {
    setImportProgress(null);
    setImportResult(null);
    setImportRows([]);
    setImportFile(null);
    setImportModalOpen(true);
  };

  const closeImportModal = () => {
    if (importing) return;
    setImportModalOpen(false);
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [modalReg, setModalReg] = useState(null);

  const toggleSelectAll = () => {
    const allPageSelected = pageRows.length > 0 && pageRows.every(({ reg }) => selectedIds.has(reg.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      pageRows.forEach(({ reg }) => {
        if (allPageSelected) next.delete(reg.id);
        else next.add(reg.id);
      });
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = await confirm({
      title: "Delete registrations",
      description: `Delete ${selectedIds.size} registration${selectedIds.size === 1 ? "" : "s"}? This cannot be undone.`,
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!confirmed) return;
    setDeleting(true);
    const ids = Array.from(selectedIds);
    try {
      // The entity API's deleteMany filter only supports equality, so delete
      // each selected registration individually rather than passing an array.
      const results = await Promise.allSettled(ids.map((id) => db.entities.Registration.delete(id)));
      const failed = results.filter((result) => result.status === "rejected");
      const deleted = ids.length - failed.length;
      const refreshed = await db.entities.Registration.filter({ event_id: eventId });
      setRegs(refreshed || []);
      setSelectedIds(new Set());
      if (failed.length > 0) {
        toast({
          variant: "destructive",
          title: `Deleted ${deleted} of ${ids.length} registrations`,
          description: failed[0].reason?.message,
        });
      } else {
        toast({ title: `Deleted ${deleted} registration${deleted === 1 ? "" : "s"}` });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Delete failed", description: err?.message });
    } finally {
      setDeleting(false);
    }
  };

  const handleCheckIn = async (regId) => {
    setModalAction('checkin');
    try {
      const res = await db.entities.Registration.update(regId, {
        status: 'checked_in',
        checked_in_at: new Date().toISOString(),
        checked_in_by: user?.id || null,
      });
      const refreshed = await db.entities.Registration.filter({ event_id: eventId });
      setRegs(refreshed || []);
      setModalReg(res); // Update modal with fresh data
      toast({ title: "Checked in successfully" });
    } catch (err) {
      toast({ variant: "destructive", title: "Check-in failed", description: err?.message });
    } finally {
      setModalAction(null);
    }
  };

  const handleCancel = async (regId) => {
    const confirmed = await confirm({
      title: "Cancel registration",
      description: "Cancel this registration? This cannot be undone.",
      confirmText: "Cancel",
      variant: "destructive",
    });
    if (!confirmed) return;
    setModalAction('cancel');
    try {
      const res = await db.entities.Registration.update(regId, { status: 'cancelled' });
      const refreshed = await db.entities.Registration.filter({ event_id: eventId });
      setRegs(refreshed || []);
      setModalReg(res); // Update modal with fresh data
      toast({ title: "Registration cancelled" });
    } catch (err) {
      toast({ variant: "destructive", title: "Cancel failed", description: err?.message });
    } finally {
      setModalAction(null);
    }
  };

  const handleUndoCancel = async (regId) => {
    const confirmed = await confirm({
      title: "Restore registration",
      description: "Restore this registration?",
      confirmText: "Restore",
      variant: "default",
    });
    if (!confirmed) return;
    setModalAction('cancel');
    try {
      const res = await db.entities.Registration.update(regId, { status: 'confirmed', checked_in_at: null, checked_in_by: null });
      const refreshed = await db.entities.Registration.filter({ event_id: eventId });
      setRegs(refreshed || []);
      setModalReg(res);
      toast({ title: "Registration restored" });
    } catch (err) {
      toast({ variant: "destructive", title: "Restore failed", description: err?.message });
    } finally {
      setModalAction(null);
    }
  };

  useEffect(() => {
    db.entities.Event.get(eventId).then(setEvent).catch(() => setEvent(null));
    db.entities.Registration.filter({ event_id: eventId }).then((l) => setRegs(l || [])).catch(() => setRegs([]));
    db.entities.User.list("-created_date", 1000).then((l) => {
      const map = {};
      (l || []).forEach((u) => { map[u.id] = u; });
      setUsers(map);
    }).catch(() => setUsers({}));
  }, [eventId]);

  const formFields = useMemo(() => event?.form_fields || [], [event]);
  // Email is already its own column, so don't repeat email-type fields.
  const tableFields = formFields.filter((f) => f.type !== "email");

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
    const filterField = formFields.find((f) => f.id === fieldFilterId);
    const filterValue = fieldFilterValue.trim().toLowerCase();
    if (filterField && filterValue) {
      const exact = fieldHasOptions(filterField.type);
      r = r.filter((x) => {
        const raw = x.reg.responses?.[filterField.id];
        const values = (Array.isArray(raw) ? raw : raw != null ? [raw] : []).map((v) => String(v).toLowerCase());
        return exact ? values.includes(filterValue) : values.some((v) => v.includes(filterValue));
      });
    }
    r.sort((a, b) => {
      if (sortKey === "date_desc") return new Date(b.reg.created_date).getTime() - new Date(a.reg.created_date).getTime();
      if (sortKey === "date_asc") return new Date(a.reg.created_date).getTime() - new Date(b.reg.created_date).getTime();
      if (sortKey === "number_asc") return a.reg.registration_number.localeCompare(b.reg.registration_number);
      if (sortKey === "name_asc") return (a.user?.full_name || "").localeCompare(b.user?.full_name || "");
      return 0;
    });
    return r;
  }, [regs, users, query, statusFilter, sortKey, formFields, fieldFilterId, fieldFilterValue]);

  const fieldFilter = formFields.find((f) => f.id === fieldFilterId);
  const fieldFilterHasOptions = fieldFilter ? fieldHasOptions(fieldFilter.type) : false;

  const pageCount = rows ? Math.max(1, Math.ceil(rows.length / PAGE_SIZE)) : 1;
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = rows ? rows.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE) : [];
  const pageIds = pageRows.map(({ reg }) => reg.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

  const getFormFields = () => formFields;

  const exportCsv = () => {
    if (!rows) return;
    const fieldHeaders = formFields.map((f) => f.label);
    const header = ["Registration", "Email", ...fieldHeaders, "Registered", "Status", "Checked in"];
    const lines = rows.map((x) => {
      const fieldValues = formFields.map((f) => {
        const val = x.reg.responses?.[f.id];
        if (Array.isArray(val)) return val.join("; ");
        return val ?? "";
      });
      return [
        x.reg.registration_number,
        x.user?.email || x.reg.guest_email || "",
        ...fieldValues,
        x.reg.created_date ? formatDateTime(x.reg.created_date) : "",
        x.reg.status,
        x.reg.checked_in_at ? formatDateTime(x.reg.checked_in_at) : "",
      ];
    });
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

  const handleImportFile = async () => {
    if (!importFile) return;
    const file = importFile;
    setImporting(true);
    setImportResult(null);
    setImportRows([]);
    setImportProgress({ processed: 0, total: 0, created: 0, skipped: 0, failed: 0, stage: "reading" });
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        toast({ variant: "destructive", title: "No rows found in file" });
        setImportProgress(null);
        return;
      }

      const formFields = getFormFields();
      const firstRow = rows[0].map((c) => String(c).trim());
      const firstRowLower = firstRow.map((c) => c.toLowerCase());

      // Detect header: exact match on known header names or form field labels
      const knownHeaders = ["registration", "email", "registered", "status", "checked in", "check-in"];
      const hasKnownHeader = firstRowLower.some((c) => knownHeaders.includes(c));
      const hasFormFieldHeader = formFields.some((f) => firstRowLower.includes(f.label.toLowerCase()));
      const hasHeader = hasKnownHeader || hasFormFieldHeader;

      const headerRow = hasHeader ? firstRow : null;
      const dataRows = hasHeader ? rows.slice(1) : rows;

      // Map CSV column index -> form field ID, plus find email column
      const columnToField = {};
      let emailColumnIdx = null;

      if (headerRow) {
        headerRow.forEach((col, idx) => {
          const colLower = String(col).trim().toLowerCase();
          if (colLower === "email") {
            // Keep the first "Email" column; a form field could share the label.
            if (emailColumnIdx === null) emailColumnIdx = idx;
          } else if (colLower === "registration") {
            // Ignored on import; kept so column indices stay aligned.
          } else {
            const field = formFields.find((f) => f.label.toLowerCase() === colLower);
            if (field) columnToField[idx] = field.id;
          }
        });
      } else {
        // No header: infer format from column count
        const numCols = rows[0].length;
        const expectedWithReg = 2 + formFields.length;
        const expectedNoReg = 1 + formFields.length;

        if (numCols === expectedWithReg) {
          emailColumnIdx = 1;
          formFields.forEach((f, idx) => { columnToField[idx + 2] = f.id; });
        } else if (numCols === expectedNoReg) {
          emailColumnIdx = 0;
          formFields.forEach((f, idx) => { columnToField[idx + 1] = f.id; });
        } else {
          formFields.forEach((f, idx) => { columnToField[idx] = f.id; });
        }
      }

      const existingEmails = new Set((regs || []).filter((r) => r.guest_email).map((r) => r.guest_email.toLowerCase()));
      const seen = new Set();
      const emailCounts = new Map(); // Track duplicate emails within this import batch
      const details = [];
      let batch = [];
      let created = 0;
      let skipped = 0;
      let failed = 0;

      setImportProgress({ processed: 0, total: dataRows.length, created: 0, skipped: 0, failed: 0, stage: "preparing" });

      // Save queued rows in chunks so the modal can show per-row results live.
      const flushBatch = async () => {
        if (batch.length === 0) return;
        const chunk = batch;
        batch = [];
        chunk.forEach(({ detailIndex }) => {
          details[detailIndex].status = "saving";
          details[detailIndex].reason = "Saving…";
        });
        setImportRows([...details]);

        let results = [];
        try {
          results = await db.entities.Registration.bulkCreate(chunk.map(({ payload }) => payload));
        } catch (err) {
          chunk.forEach(({ detailIndex }) => {
            details[detailIndex].status = "failed";
            details[detailIndex].reason = err?.message || "Import failed";
            failed++;
          });
          setImportRows([...details]);
          return;
        }

        chunk.forEach(({ detailIndex }, offset) => {
          const result = Array.isArray(results) ? results[offset] : null;
          if (result?.ok) {
            details[detailIndex].status = "success";
            details[detailIndex].reason = "";
            created++;
          } else {
            details[detailIndex].status = "failed";
            details[detailIndex].reason = result?.error || "Could not import this row";
            failed++;
          }
        });
        setImportRows([...details]);
      };

      for (let i = 0; i < dataRows.length; i++) {
        const r = dataRows[i];
        const responses = {};
        let guestEmail = null;
        let guestName = null;

        // Extract form field values from mapped columns
        Object.entries(columnToField).forEach(([colIdx, fieldId]) => {
          const val = (r[Number(colIdx)] || "").trim();
          if (val) responses[fieldId] = val;
        });

        // Get email from explicit email column
        if (emailColumnIdx !== null && r[emailColumnIdx]) {
          guestEmail = r[emailColumnIdx].trim().toLowerCase();
        }

        // Fallback: find email from email-type form field
        for (const f of formFields) {
          if (f.type === "email" && responses[f.id] && !guestEmail) {
            guestEmail = responses[f.id].toLowerCase();
          }
        }

        // Find name from a name-like field, falling back to any text field
        const nameField =
          formFields.find((f) => f.label.toLowerCase().includes("name")) ||
          formFields.find((f) => f.type === "text");
        if (nameField && responses[nameField.id]) {
          const value = responses[nameField.id];
          guestName = Array.isArray(value) ? value.join(" ") : String(value);
        }

        const detail = {
          row: i + (hasHeader ? 2 : 1),
          name: guestName || "",
          email: guestEmail || "",
          status: "pending",
          reason: "",
        };

        // Deduplication: prefer email, fallback to name
        const dedupeKey = guestEmail || guestName;
        if (!dedupeKey) {
          detail.status = "skipped";
          detail.reason = "Missing email and name";
          skipped++;
        } else if (!allowDuplicateEmails && (existingEmails.has(dedupeKey) || seen.has(dedupeKey))) {
          detail.status = "skipped";
          detail.reason = existingEmails.has(dedupeKey)
            ? "Already registered for this event"
            : "Duplicate row in this file";
          skipped++;
        } else {
          seen.add(dedupeKey);

          // When allowing duplicate emails, make each guest_email unique by appending a counter
          // This bypasses the DB unique index on { event_id, guest_email }
          let finalGuestEmail = guestEmail;
          if (allowDuplicateEmails && guestEmail) {
            const count = emailCounts.get(guestEmail) || 0;
            if (count > 0 || existingEmails.has(guestEmail)) {
              finalGuestEmail = `${guestEmail}#${count + 1}`;
            }
            emailCounts.set(guestEmail, count + 1);
          }

          detail.status = "pending";
          detail.reason = "Waiting to save";
          batch.push({
            detailIndex: details.length,
            payload: {
              event_id: event.id,
              event_name: event.name,
              guest_name: guestName,
              guest_email: finalGuestEmail,
              registration_number: genNumber(),
              qr_token: genToken(),
              status: "confirmed",
              responses,
              _importMode: true,
            },
          });
        }

        details.push(detail);

        if (batch.length >= IMPORT_CHUNK_SIZE) await flushBatch();

        // Let the browser paint the live row log while long files are processed.
        if ((i + 1) % IMPORT_YIELD_EVERY === 0 || i === dataRows.length - 1) {
          setImportRows([...details]);
          setImportProgress({
            processed: i + 1,
            total: dataRows.length,
            created,
            skipped,
            failed,
            stage: "importing",
          });
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      await flushBatch();

      setImportProgress({
        processed: dataRows.length,
        total: dataRows.length,
        created,
        skipped,
        failed,
        stage: "complete",
      });
      setImportResult({ created, skipped, failed, total: dataRows.length });

      try {
        const refreshed = await db.entities.Registration.filter({ event_id: eventId });
        setRegs(refreshed || []);
      } catch {
        // The import succeeded; the list can be refreshed manually.
      }

      toast({
        title: `Imported ${created} attendee${created === 1 ? "" : "s"}`,
        description: failed > 0 ? `${failed} row${failed === 1 ? "" : "s"} failed.` : undefined,
      });
    } catch (err) {
      toast({ variant: "destructive", title: "Import failed", description: err?.message });
      setImportProgress(null);
    } finally {
      setImporting(false);
      setImportFile(null);
    }
  };

  if (event === undefined) return <div className="flex h-64 items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <>
      <div className="space-y-6">
        {/* Mobile Toolbar */}
        <div className="md:hidden">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => history.back()}><ArrowLeft className="w-4 h-4 mr-1.5" /> Back</Button>
          <div className="flex gap-1.5">
            <Button size="sm" asChild aria-label="Scan QR"><Link to="/admin/checkin"><ScanLine className="w-3.5 h-3.5" /></Link></Button>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows || rows.length === 0} aria-label="Export CSV"><Download className="w-3.5 h-3.5" /></Button>
            {selectedIds.size > 0 && (
              <Button size="sm" variant="destructive" onClick={handleBulkDelete} disabled={deleting} aria-label={`Delete ${selectedIds.size}`}>
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={openImportModal} disabled={importing || !event} aria-label="Import CSV">
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop Toolbar */}
      <div className="hidden md:flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => history.back()}><ArrowLeft className="w-4 h-4 mr-1.5" /> Back</Button>
        <div className="flex items-center gap-2">
          <Button size="sm" asChild><Link to="/admin/checkin"><ScanLine className="w-3.5 h-3.5 mr-1" /> Scan QR</Link></Button>
          <Button size="sm" variant="outline" onClick={openImportModal} disabled={importing || !event}>
            {importing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />} Import CSV
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows || rows.length === 0}><Download className="w-3.5 h-3.5 mr-1" /> Export CSV</Button>
          {selectedIds.size > 0 && (
            <Button size="sm" variant="destructive" onClick={handleBulkDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
              Delete {selectedIds.size}
            </Button>
          )}
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Registrations</h1>
        <p className="text-sm text-muted-foreground">{event?.name} · {regs?.length || 0} total</p>
      </div>

      {/* Responsive Filters - single version for all screen sizes */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder="Search name, email or registration no." className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="checked_in">Checked in</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        {formFields.length > 0 && (
          <>
            <Select
              value={fieldFilterId || "all"}
              onValueChange={(v) => {
                setFieldFilterId(v === "all" ? "" : v);
                setFieldFilterValue("");
                setPage(0);
              }}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Filter by field" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All fields</SelectItem>
                {formFields.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.label || "Untitled field"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldFilter && fieldFilterHasOptions && (
              <Select
                value={fieldFilterValue || "all"}
                onValueChange={(v) => { setFieldFilterValue(v === "all" ? "" : v); setPage(0); }}
              >
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder={`Any ${fieldFilter.label || "value"}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any value</SelectItem>
                  {(fieldFilter.options || []).map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {fieldFilter && !fieldFilterHasOptions && (
              <div className="relative w-full sm:w-48">
                <Input
                  value={fieldFilterValue}
                  onChange={(e) => { setFieldFilterValue(e.target.value); setPage(0); }}
                  placeholder={`Filter by ${fieldFilter.label || "value"}`}
                  className="pr-8"
                />
                {fieldFilterValue && (
                  <button
                    type="button"
                    onClick={() => { setFieldFilterValue(""); setPage(0); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground"
                    aria-label="Clear field filter"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </>
        )}
        <Select value={sortKey} onValueChange={setSortKey}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="date_desc">Newest first</SelectItem>
            <SelectItem value="date_asc">Oldest first</SelectItem>
            <SelectItem value="number_asc">Registration no.</SelectItem>
            <SelectItem value="name_asc">Guest name</SelectItem>
          </SelectContent>
        </Select>
        </div>

      <Card className="overflow-hidden">

        {/* Responsive Table - Table on desktop, cards on mobile */}
        <div className="hidden md:block">
          {/* Desktop Table View */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium w-10">
                    <Checkbox
                      checked={allPageSelected}
                      indeterminate={somePageSelected && !allPageSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">Registration</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  {tableFields.map((f) => (
                    <th key={f.id} className="px-4 py-3 font-medium">{f.label}</th>
                  ))}
                  <th className="px-4 py-3 font-medium">Registered</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Check-in</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows === null ? (
                  <tr><td colSpan={7 + tableFields.length} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
                ) : pageRows.length === 0 ? (
                  <tr><td colSpan={7 + tableFields.length} className="px-4 py-10 text-center text-muted-foreground">No registrations found.</td></tr>
                ) : pageRows.map(({ reg, user }) => {
                  const displayEmail = user?.email || reg.guest_email;
                  return (
                    <tr key={reg.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedIds.has(reg.id)}
                          onCheckedChange={() => toggleSelect(reg.id)}
                          aria-label={`Select registration ${reg.registration_number}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{reg.registration_number}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{displayEmail || "—"}</div>
                      </td>
                      {tableFields.map((f) => (
                        <td key={f.id} className="px-4 py-3">
                          {(() => {
                            const val = reg.responses?.[f.id];
                            if (val === undefined || val === null || val === "") return <span className="text-muted-foreground">—</span>;
                            if (Array.isArray(val)) return <span>{val.join(", ")}</span>;
                            return <span>{String(val)}</span>;
                          })()}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-muted-foreground">{reg.created_date ? formatDateShort(reg.created_date) : "—"}</td>
                      <td className="px-4 py-3"><RegStatusBadge status={reg.status} /></td>
                      <td className="px-4 py-3 text-xs">{reg.checked_in_at ? formatDateTime(reg.checked_in_at) : <span className="text-muted-foreground">Not checked in</span>}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => setModalReg(reg)}><Eye className="w-3.5 h-3.5" /></Button>
                          <Button asChild size="sm" variant="ghost"><Link to={`/tickets/${reg.id}`}><TicketIcon className="w-3.5 h-3.5" /></Link></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden">
          {rows === null ? (
            <div className="flex h-40 items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>
          ) : pageRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">No registrations found.</div>
          ) : (
            <div className="divide-y divide-border">
              {pageRows.map(({ reg, user }) => {
                const displayEmail = user?.email || reg.guest_email;
                const isSelected = selectedIds.has(reg.id);
                return (
                  <div key={reg.id} className={`p-4 ${isSelected ? "bg-primary/5" : "hover:bg-muted/30"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(reg.id)}
                        aria-label={`Select registration ${reg.registration_number}`}
                      />
                      <div className="flex-1 min-w-0 flex flex-col gap-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-mono text-xs font-medium">{reg.registration_number}</span>
                          <RegStatusBadge status={reg.status} />
                        </div>
                        <div className="text-sm truncate text-foreground">{displayEmail || "—"}</div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span>{reg.created_date ? formatDateShort(reg.created_date) : "—"}</span>
                          {tableFields.length > 0 && (
                            <span className="hidden sm:inline">
                              {tableFields.map((f) => {
                                const val = reg.responses?.[f.id];
                                if (val === undefined || val === null || val === "") return null;
                                const displayVal = Array.isArray(val) ? val.join(", ") : String(val);
                                return <span key={f.id}>{f.label}: {displayVal}</span>;
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setModalReg(reg)}
                        aria-label="View details"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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
      {/* Desktop Modal - shows registration details */}
      {modalReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !modalAction && setModalReg(null)}>
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-4 md:mx-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold">{modalReg.registration_number}</h3>
                <RegStatusBadge status={modalReg.status} />
              </div>
              <Button variant="ghost" size="icon" onClick={() => !modalAction && setModalReg(null)} aria-label="Close">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-4 space-y-4">
              {/* QR Code / Ticket */}
              <div className="text-center space-y-2">
                <p className="text-xs text-muted-foreground">Check-in QR Code</p>
                <QRCode value={qrCheckinUrl(modalReg.qr_token)} size={180} className="mx-auto" />
                <p className="text-xs text-muted-foreground font-mono break-all">{qrCheckinUrl(modalReg.qr_token)}</p>
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium">{(users[modalReg.user_id]?.email || modalReg.guest_email) || "—"}</p>
                </div>
                {tableFields.map((f) => {
                  const val = modalReg.responses?.[f.id];
                  if (val === undefined || val === null || val === "") return null;
                  const displayVal = Array.isArray(val) ? val.join(", ") : String(val);
                  return (
                    <div key={f.id} className="space-y-1">
                      <p className="text-xs text-muted-foreground">{f.label}</p>
                      <p className="font-medium">{displayVal}</p>
                    </div>
                  );
                })}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Registered</p>
                  <p className="font-medium">{modalReg.created_date ? formatDateShort(modalReg.created_date) : "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Check-in</p>
                  <p className="font-medium">{modalReg.checked_in_at ? formatDateTime(modalReg.checked_in_at) : "Not checked in"}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button asChild variant="outline" className="flex-1 min-w-[120px]"><Link to={`/admin/registrations/${modalReg.id}`} onClick={() => setModalReg(null)}><Eye className="w-3.5 h-3.5 mr-1" /> Details</Link></Button>
                <Button asChild className="flex-1 min-w-[120px]"><Link to={`/tickets/${modalReg.id}`} onClick={() => setModalReg(null)}><TicketIcon className="w-3.5 h-3.5 mr-1" /> Ticket</Link></Button>

                {modalReg.status === 'confirmed' && (
                  <Button
                    className="flex-1 min-w-[120px]"
                    onClick={() => handleCheckIn(modalReg.id)}
                    disabled={modalAction === 'checkin'}
                  >
                    {modalAction === 'checkin' ? <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5 mr-1" />} Check In
                  </Button>
                )}

                {modalReg.status === 'confirmed' && (
                  <Button
                    variant="destructive"
                    className="flex-1 min-w-[120px]"
                    onClick={() => handleCancel(modalReg.id)}
                    disabled={modalAction === 'cancel'}
                  >
                    {modalAction === 'cancel' ? <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <XCircle className="w-3.5 h-3.5 mr-1" />} Cancel
                  </Button>
                )}

                {modalReg.status === 'cancelled' && (
                  <Button
                    variant="outline"
                    className="flex-1 min-w-[120px]"
                    onClick={() => handleUndoCancel(modalReg.id)}
                    disabled={modalAction === 'cancel'}
                  >
                    {modalAction === 'cancel' ? <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />} Restore
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Import CSV Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeImportModal}>
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="font-semibold">Import CSV</h3>
                <p className="text-xs text-muted-foreground">
                  {importProgress?.stage === "complete" ? "Import finished" : importing ? "Import in progress…" : "Upload a CSV to import attendees"}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={closeImportModal} disabled={importing} aria-label="Close">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-4 space-y-4">
              {!importResult && (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">CSV File</label>
                    <FileUploadZone
                      file={importFile}
                      onFileSelect={setImportFile}
                      onFileRemove={() => setImportFile(null)}
                      disabled={importing}
                      accept=".csv,text/csv"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={allowDuplicateEmails}
                      onCheckedChange={setAllowDuplicateEmails}
                      disabled={importing}
                      aria-label="Allow duplicate emails in import"
                    />
                    <span className="text-sm text-muted-foreground">Allow duplicate emails</span>
                  </div>
                </>
              )}

              {importProgress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {importProgress.stage === "complete"
                        ? "Import complete"
                        : importProgress.stage === "reading"
                          ? "Reading file…"
                          : importProgress.stage === "preparing"
                            ? "Preparing rows…"
                            : "Importing rows…"}
                    </span>
                    <span className="text-muted-foreground">
                      {importProgress.total > 0 ? `${importProgress.processed} / ${importProgress.total}` : ""}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${importProgress.total > 0 ? (importProgress.processed / importProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Success: <span className="font-medium text-emerald-600">{importProgress.created}</span></span>
                    <span>Skipped: <span className="font-medium text-amber-600">{importProgress.skipped}</span></span>
                    <span>Failed: <span className="font-medium text-rose-600">{importProgress.failed}</span></span>
                  </div>
                </div>
              )}

              {importRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Import details</p>
                    <p className="text-xs text-muted-foreground">{importRows.length} row{importRows.length === 1 ? "" : "s"}</p>
                  </div>
                  <div className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                    {importRows.map((row) => {
                      const meta = IMPORT_ROW_STATUS[row.status] || IMPORT_ROW_STATUS.pending;
                      return (
                        <div key={row.row} className="flex items-start gap-2 px-2.5 py-1.5">
                          <span className="w-7 shrink-0 pt-0.5 text-right font-mono text-[10px] text-muted-foreground">{row.row}</span>
                          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium">
                              {row.name || row.email || <span className="text-muted-foreground">(empty row)</span>}
                            </div>
                            {row.name && row.email && (
                              <div className="truncate text-[11px] text-muted-foreground">{row.email}</div>
                            )}
                            {row.reason && <div className={`text-[11px] ${meta.text}`}>{row.reason}</div>}
                          </div>
                          <span className={`shrink-0 pt-0.5 text-[11px] font-medium ${meta.text}`}>{meta.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {importResult && (
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  Import finished: <span className="font-medium text-emerald-600">{importResult.created}</span> added,
                  <span className="font-medium text-amber-600"> {importResult.skipped}</span> skipped,
                  <span className="font-medium text-rose-600"> {importResult.failed}</span> failed of {importResult.total} rows.
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t">
                {importResult ? (
                  <>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setImportProgress(null);
                        setImportResult(null);
                        setImportRows([]);
                        setImportFile(null);
                      }}
                    >
                      Import another
                    </Button>
                    <Button className="flex-1" onClick={closeImportModal}>Done</Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={closeImportModal}
                      disabled={importing}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleImportFile}
                      disabled={importing || !importFile}
                    >
                      {importing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Importing…
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5 mr-1.5" />
                          Import
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {ConfirmDialog}
    </>
  );
}
