// Shared helpers for events, tickets and registrations.

export function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function formatDateShort(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function formatTime(timeStr) {
  if (!timeStr) return "";
  // Accept "HH:mm" or "HH:mm:ss"
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr ? parseInt(mStr, 10) : 0;
  if (isNaN(h)) return timeStr;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatTimeRange(start, end) {
  const s = formatTime(start);
  const e = formatTime(end);
  if (s && e) return `${s} – ${e}`;
  return s || e || "";
}

export function formatDateTime(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function timeRangeLabel(start, end) {
  return formatTimeRange(start, end);
}

// The QR encodes a check-in URL keyed only by the secure qr_token — no PII.
export function qrCheckinUrl(qrToken) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";
  return `${origin}/checkin/${qrToken}`;
}

export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const EVENT_STATUS_STYLES = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-600 border-slate-200" },
  open: { label: "Open", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  closed: { label: "Closed", className: "bg-amber-50 text-amber-700 border-amber-200" },
  full: { label: "Full", className: "bg-rose-50 text-rose-700 border-rose-200" },
  completed: { label: "Completed", className: "bg-slate-100 text-slate-500 border-slate-200" },
};

const REG_STATUS_STYLES = {
  confirmed: { label: "Confirmed", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "Cancelled", className: "bg-rose-50 text-rose-700 border-rose-200" },
  checked_in: { label: "Checked In", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
};

export function eventStatusInfo(status) {
  return EVENT_STATUS_STYLES[status] || { label: status || "Unknown", className: "bg-slate-100 text-slate-600 border-slate-200" };
}

export function regStatusInfo(status) {
  return REG_STATUS_STYLES[status] || { label: status || "Unknown", className: "bg-slate-100 text-slate-600 border-slate-200" };
}

// Compute the effective registration availability for an event given its
// current confirmed registration count.
export function registrationAvailability(event, confirmedCount) {
  const capacity = event.max_attendees && event.max_attendees > 0 ? event.max_attendees : null;
  const remaining = capacity !== null ? Math.max(0, capacity - confirmedCount) : null;
  const isFull = capacity !== null && confirmedCount >= capacity;
  const now = new Date();
  const regStart = event.registration_start ? new Date(event.registration_start) : null;
  const regEnd = event.registration_end ? new Date(event.registration_end) : null;
  const beforeWindow = regStart && now < regStart;
  const afterWindow = regEnd && now > regEnd;

  let canRegister = true;
  let reason = "";
  if (!event.published) {
    canRegister = false;
    reason = "This event is not published.";
  } else if (event.status === "full") {
    canRegister = false;
    reason = "This event is full.";
  } else if (event.status === "closed" || afterWindow) {
    canRegister = false;
    reason = "Registration is closed.";
  } else if (event.status === "completed") {
    canRegister = false;
    reason = "This event has already concluded.";
  } else if (beforeWindow) {
    canRegister = false;
    reason = "Registration has not opened yet.";
  } else if (isFull) {
    canRegister = false;
    reason = "This event is full.";
  }
  return { canRegister, reason, remaining, capacity, isFull };
}

export const FIELD_TYPES = [
  { value: "text", label: "Short text", hasOptions: false },
  { value: "textarea", label: "Long text", hasOptions: false },
  { value: "email", label: "Email", hasOptions: false },
  { value: "phone", label: "Phone", hasOptions: false },
  { value: "number", label: "Number", hasOptions: false },
  { value: "dropdown", label: "Dropdown (pick one)", hasOptions: true },
  { value: "choice", label: "Multiple choice (pick one)", hasOptions: true },
  { value: "checkboxes", label: "Checkboxes (pick many)", hasOptions: true },
];

export function fieldHasOptions(type) {
  return FIELD_TYPES.find((t) => t.value === type)?.hasOptions || false;
}

export function newField() {
  const id = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return { id, label: "", type: "text", required: false, placeholder: "", options: [] };
}