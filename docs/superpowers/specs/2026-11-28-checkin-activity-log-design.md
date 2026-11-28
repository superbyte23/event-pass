# Persistent check-in activity + scan log modal

## Intent
Staff need one place to review who has been checked in for the current event,
when each check-in happened, and how it happened. The scanner's "Recent scans"
list is temporary React state today; scan history must survive a page reload,
and button-driven check-ins must be distinguishable from ticket-code entry.

## Goals
- A toolbar button on the event registration page opens a modal with two tabs:
  - **Checked-in guests**: registrations with `status: checked_in`, sorted by
    `checked_in_at` descending, showing guest, registration number, time and
    method.
  - **Scan log**: persistent log entries, newest first, showing guest,
    registration number, time, method and whether the scan was a repeat
    ("already in").
- Log successful check-ins and repeat scans (the same set the current in-scanner
  "Recent scans" list shows). Do not log failed scans.
- Record the method for every check-in: `qr_scan` (camera), `manual_entry`
  (typed ticket code in the scanner), `manual_button` (Check In button on a
  registration).
- Keep the scanner's own "Recent scans" list working as immediate feedback.

## Non-goals / anti-goals
- Do not change the global `/admin/checkin` page beyond the new shared scanner
  behavior; no scanner UI redesign.
- No dependency changes.
- No delete/edit UI for history; logs are append-only.
- No CSV export of the new modal.

## Data model
- `Registration`: add `check_in_method` (String, nullable, enum-like values
  above). Written by the server only; the client cannot set it through the
  generic entity update route.
- New `CheckInLog` model (not added to `MODELS`, so unreachable through generic
  entity routes): `_id`, `event_id` (indexed), `registration_id` (indexed),
  `registration_number`, `guest_name`, `guest_email`, `method`, `already`
  (Boolean), `admin_id`, `created_date`.

## Write paths
- `POST /api/admin/checkin`: accepts an enum-validated `method` (`qr_scan` or
  `manual_entry`), defaults to `qr_scan` for backward compatibility. On a
  successful first check-in, set `check_in_method` on the registration. On both
  first check-ins and repeat (`already: true`) scans, append a `CheckInLog` row.
  `admin_id` always comes from the session.
- Generic `Registration` update (the Check In button): when the update flips
  `status` from something else to `checked_in`, force `check_in_method:
  'manual_button'` and append a log row. Strip any client-supplied
  `check_in_method` so the method cannot be faked. Un-check-in ("Restore")
  does not delete history.

## API / client
- `GET /api/admin/checkin?event_id=...`: admin-only, returns logs for that
  event sorted by `created_date` descending, capped at 100. No event id means
  no logs (the global page is out of scope).
- Add the call to the `db` shim (`db.checkinLogs.list(eventId)`); views keep
  using the shim as their only data-access path.
- `checkInByQrValue(value, eventId, method)` passes the method through;
  `AdminCheckIn` supplies `qr_scan` for camera hits and `manual_entry` for the
  form, and includes the method in its local "Recent scans" entries.

## UI
- Add an "Activity" button beside the existing toolbar actions (desktop and
  mobile) on the registration page.
- New dialog component with simple tab buttons (no new UI dependency):
  "Checked-in guests" and "Scan log". Load the log tab on open; refresh it and
  the registration list after a check-in where practical.
- Empty state for each tab; long lists scroll inside the dialog.

## Verification
- Source assertions (no test runner in repo) for method wiring, log writes and
  tab rendering, plus `npm run lint`, `npm run typecheck`, `npm run build`.
