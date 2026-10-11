// Client helpers for admin QR check-in.

// Pull the token out of whatever the scanner returns (bare token, `/checkin/<t>`
// path, or the full origin URL encoded in the ticket QR).
export function parseQrValue(value) {
  const s = String(value || "").trim().split(/[?#]/)[0];
  if (!s) return "";
  const m = s.match(/(?:^|\/)([A-Za-z0-9_-]{6,})\/?$/);
  return m ? m[1] : s;
}

export async function checkInByQrValue(value) {
  const res = await fetch(`/api/admin/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: String(value || "").trim() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || "Check-in failed.");
    err.status = res.status;
    throw err;
  }
  return data;
}