# Event-scoped QR check-in on the registrations page

Date: 2026-11-28 · Size: small change

## Intent

Door staff working from a specific event's registrations page should be able to scan
tickets there, and only that event's tickets should check in. Today the page's
**Scan QR** button navigates to the global `/admin/checkin`, which accepts any
event's ticket.

## Goals

- **Scan QR** on `/admin/events/:event/registrations` opens the scanner on that same page (a dialog), leaving the registration list in place.
- The scanner supports the existing camera flow, manual entry, repeat-scan handling, and result display.
- Check-in requests carry the page's event id; the server rejects a ticket belonging to a different event.
- After a successful check-in the registrations table reloads, so the row shows the new status.

## Non-goals

- No new route, no change to ticket QR contents, email links, or the `/checkin/:token` flow.
- No change to the global `/admin/checkin` page: it stays available for scanning any event.
- No new authorization model or dependency.

## Constraints

- `AdminCheckIn.jsx` is ~400 lines of camera/decoder/queue logic — reuse it rather than duplicate it.
- `checkInRegistration(token, user)` has one caller (the check-in route); the event id is an optional restriction, never a way to widen access. Admin auth and rate limiting stay as they are.
- Client-supplied event id is untrusted, but only narrows the lookup, so a forged id cannot check in an unrelated ticket.

## Approaches

1. **Reuse `AdminCheckIn` with props, add optional server filter (chosen).** Add `eventId` and `onCheckedIn` props to the existing scanner; render it in a dialog on the registrations page; thread `event_id` through the client helper, API route, and `checkInRegistration`. Smallest diff, no duplication, global scanner untouched.
2. Extract the scanner into a shared hook and rewrite both pages. Rejected: a large refactor for no added behavior.
3. Add `/admin/events/:event/checkin` as a separate page. Rejected: staff leave the registration list; more route/UI surface for the same job.

## Design

- `src/lib/checkin.js`: `checkInByQrValue(value, eventId)` includes `event_id` in the JSON body when provided.
- `app/api/admin/checkin/route.js`: reads `body.event_id`, passes it as the third argument to `checkInRegistration`.
- `src/server/entity-api.js`: `checkInRegistration(token, user, eventId)` adds `event_id` to both the QR-token lookup and the registration-number fallback lookup. Response shapes (`already`, `registration`) and cancelled/checked-in handling are unchanged.
- `src/views/admin/AdminCheckIn.jsx`: optional `eventId` prop passed to the helper; optional `onCheckedIn(data)` callback invoked on success. Global route passes neither, so behavior is identical there.
- `src/views/admin/AdminRegistrations.jsx`: both **Scan QR** buttons open one dialog wrapping `<AdminCheckIn eventId={eventId} onCheckedIn={...} />`; the callback re-fetches registrations with `db.entities.Registration.filter({ event_id: eventId })` — the same call the page already uses elsewhere. Dialog unmount stops the camera via the scanner's existing cleanup.
- Verification: `npm run lint`, `npm run typecheck`, `npm run build`, plus an assert-based check that the scoped lookup rejects a ticket from another event.
