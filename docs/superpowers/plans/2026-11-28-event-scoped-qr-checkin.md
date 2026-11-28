# Event-scoped QR check-in on the registrations page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff scan/check in tickets from `/admin/events/:event/registrations` without leaving the page, accepting only that event's tickets.

**Architecture:** Reuse the existing camera/manual scanner (`AdminCheckIn`) in a dialog on the registrations page with an `eventId` prop. Thread an optional `event_id` from the client helper through the check-in route into `checkInRegistration`, where it narrows both ticket lookups. The global `/admin/checkin` page and `/checkin/:token` flow keep today's behavior.

**Tech Stack:** Next.js 16 route handlers, React 19, Radix dialog (`@/components/ui/dialog`), Mongoose, lucide-react, Node assert for the self-check (no test framework in repo).

**Spec:** `docs/superpowers/specs/2026-11-28-event-scoped-qr-checkin-design.md`

## Global Constraints

- Keep all data access in views/components behind `db` (`src/api/db.js`); the scanner's check-in call already goes through `/api/admin/checkin`, which is fine.
- Server errors stay JSON `{ message }` with a proper HTTP status. The existing `ApiError(404, 'No registration matches this code.')` wording is reused for a wrong-event ticket so event membership isn't leaked.
- Admin auth and rate limiting on `/api/admin/checkin` stay unchanged.
- `package.json` uses ESM (`"type": "module"`); no new dependencies.
- Before finishing: `npm run lint`, `npm run typecheck`, and `npm run build` must all pass (baseline: no warnings, build needs no env vars).

## Review Focus

- A ticket from another event scanned in the scoped dialog: rejected, no status change — pinned in Task 1's self-check (both lookups carry `event_id`).
- Manual REG-number entry in the scoped dialog: subject to the same event restriction — pinned in Task 1's self-check (fallback lookup carries `event_id`).
- Global `/admin/checkin` called without `event_id`: keeps checking in any event's ticket — pinned in Task 1's self-check (no `event_id` key when omitted).
- Closing the scanner dialog leaves the camera running: the dialog must unmount `<AdminCheckIn>` so its existing effect cleanup stops tracks and timers — pinned in Task 2's verification step (conditional render, not hidden).
- After a successful scan the table still shows the old status: `onCheckedIn` must trigger the existing `db.entities.Registration.filter({ event_id: eventId })` refresh — pinned in Task 2's verification step.

---

### Task 1: Event-scoped check-in API and client helper

**Files:**
- Modify: `src/server/entity-api.js` (`checkInRegistration`, around line 380)
- Modify: `app/api/admin/checkin/route.js` (POST body parsing, line 34)
- Modify: `src/lib/checkin.js` (`checkInByQrValue`, line 12)
- Create (throwaway, outside repo): self-check script under `C:\Users\Windows\AppData\Local\Temp\opencode\`

**Interfaces:**
- Consumes: `checkInRegistration(token, user)` existing signature; `ApiError`; `Registration` model from `src/db/models.js`.
- Produces: `checkInRegistration(token, user, eventId)` → `{ registration, already }` (unchanged shape); `checkInByQrValue(value, eventId)` → same response data; API route reads `body.event_id`.

- [ ] **Step 1: Write the failing self-check script**

Create a throwaway `.mjs` script that stubs Mongoose/model calls (no live DB) and asserts the scoped lookups:

```js
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/unused';
mongoose.connect = async () => mongoose.connection;

const { Registration } = await import('file:///C:/envkit/projects/event-pass/src/db/models.js');
const { checkInRegistration } = await import('file:///C:/envkit/projects/event-pass/src/server/entity-api.js');

const queries = [];
Registration.findOne = async (query) => { queries.push(query); return null; };
const admin = { id: 'admin-1', role: 'admin' };

await assert.rejects(() => checkInRegistration('ABCDEFGH123', admin, '4249b537-ac33-4712-9736-0c2caaf4dc3d'), {
  message: 'No registration matches this code.',
});
assert.equal(queries.length, 2); // QR token lookup + REG-number fallback
for (const query of queries) {
  assert.equal(query.event_id, '4249b537-ac33-4712-9736-0c2caaf4dc3d');
}

queries.length = 0;
await assert.rejects(() => checkInRegistration('ABCDEFGH123', admin), {
  message: 'No registration matches this code.',
});
for (const query of queries) assert.ok(!('event_id' in query));
console.log('scoped check-in lookups OK');
```

- [ ] **Step 2: Run it and verify it fails**

Run: `node <throwaway-script>.mjs`
Expected: FAIL — `query.event_id` is `undefined` (the current function takes no event id).

- [ ] **Step 3: Implement the scoped lookup**

In `src/server/entity-api.js`, change the signature to `checkInRegistration(token, user, eventId)`, derive `const eventFilter = eventId ? { event_id: eventId } : {};`, and spread it into **both** `Registration.findOne` queries (the `qr_token` lookup and the `registration_number` fallback). Keep every other line of the function unchanged.

In `app/api/admin/checkin/route.js`, pass `body?.event_id` as the third argument to `checkInRegistration`.

In `src/lib/checkin.js`, change to `checkInByQrValue(value, eventId)` and include `event_id` in the JSON body only when `eventId` is truthy. Global callers always invoke it with one argument and stay unchanged.

- [ ] **Step 4: Re-run the self-check**

Run: `node <throwaway-script>.mjs`
Expected: PASS — prints `scoped check-in lookups OK`.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

### Task 2: Scanner in the event registrations dialog

**Files:**
- Modify: `src/views/admin/AdminCheckIn.jsx` (component signature, line 20; success path, lines 55-61)
- Modify: `src/views/admin/AdminRegistrations.jsx` (imports, state near line 187, both Scan QR buttons at lines 696 and 719, dialog near the other modals before the closing fragment)

**Interfaces:**
- Consumes: `checkInByQrValue(value, eventId)` from Task 1; existing dialog primitives from `@/components/ui/dialog`.
- Produces: `AdminCheckIn({ eventId, onCheckedIn })` — `onCheckedIn(data)` called after each successful check-in; global route renders `<AdminCheckIn />` with no props.

- [ ] **Step 1: Add optional props to the scanner**

Change the component to `export default function AdminCheckIn({ eventId, onCheckedIn })`. Pass `eventId` as the second argument to `checkInByQrValue(token)` inside `drainQueue`, and call `onCheckedIn?.(data)` immediately after `setResult({ ...data, token })` on success. Add default values `eventId = undefined, onCheckedIn = undefined` per the project's optional-props convention. Do not touch the camera/queue logic.

- [ ] **Step 2: Wire the dialog into the registrations page**

Add `Dialog, DialogContent, DialogHeader, DialogTitle` imports and `AdminCheckIn` import; add `const [scanOpen, setScanOpen] = useState(false);` and a `refreshRegs` callback that runs `db.entities.Registration.filter({ event_id: eventId })` and `setRegs(refreshed || [])`. Replace both `<Button asChild><Link to="/admin/checkin">…Scan QR…</Link></Button>` instances with buttons having `onClick={() => setScanOpen(true)}` (keep their existing labels/icons and aria-label). Render once near the other modals:

```jsx
<Dialog open={scanOpen} onOpenChange={setScanOpen}>
  <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
    <DialogHeader><DialogTitle>QR Check-in — {event?.name || "event"}</DialogTitle></DialogHeader>
    {scanOpen && <AdminCheckIn eventId={eventId} onCheckedIn={refreshRegs} />}
  </DialogContent>
</Dialog>
```

Remove the `Link` import only if nothing else in the file uses it (check with grep first).

- [ ] **Step 3: Verify the camera and refresh wiring**

Read back the two changed sections and confirm: `<AdminCheckIn>` is conditionally rendered (so closing the dialog unmounts it and the scanner's existing cleanup stops the camera), `eventId` comes from `useParams()`, and `onCheckedIn` refreshes rows with the same filter used elsewhere in the page.

- [ ] **Step 4: Full verification**

Run: `npm run lint`, then `npm run typecheck`, then `npm run build`
Expected: all PASS, no warnings, `build` needs no env vars.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers app/api/admin/checkin/route.js src/lib/checkin.js src/server/entity-api.js src/views/admin/AdminCheckIn.jsx src/views/admin/AdminRegistrations.jsx
git commit -m "feat: event-scoped QR check-in on registration page"
```
