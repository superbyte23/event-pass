# Check-in Activity Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist check-in/scan history with its method and expose it in a two-tab activity modal on an event's registration page.

**Architecture:** A `CheckInLog` Mongo collection is written by the two existing check-in write paths (ticket-code API and generic registration update), while a server-owned `check_in_method` field on `Registration` records the method for the guest list. One admin GET route reads logs through the `db` shim; a dialog on the registration page shows checked-in guests and the persistent log.

**Tech Stack:** Next.js 16 App Router route handlers, React 19, Mongoose, existing shadcn-style Dialog/Button components, Tailwind. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-28-checkin-activity-log-design.md`

## Global Constraints

- No dependency changes.
- Global `/admin/checkin` keeps its current full-page layout and behavior; only shared scanner internals may change.
- Logs are append-only: successful check-ins and repeat ("already in") scans only, never failures, never deleted on un-check-in.
- `admin_id` always comes from the session, never the client.
- The client cannot set `check_in_method` through any generic entity route.
- Views/components use the `db` shim as their only data-access path.
- `npm run lint`, `npm run typecheck`, and `npm run build` stay green with no env vars needed for build.

## Review Focus

1. A failed scan (invalid code, cancelled registration) must not create a log row — Task 2 asserts `recordCheckInLog` is only called after the error checks and in the success branch.
2. A client-sent `check_in_method` on `Registration` create/update must never be honored — Task 2 asserts the field is deleted in `assertRegistrationCreate` and `updateEntity`, and that the button path forces `manual_button`.
3. A repeat scan must not overwrite the original check-in time/method — Task 2 asserts repeat returns early from `checkInRegistration` before the update.
4. Logs from one event must not appear in another event's modal, and `/admin/checkin` must not fetch them — Task 3 asserts GET requires admin and an `event_id`, and returns `[]` without one.
5. An empty event and a mix of methods must render correctly in the modal — Task 5 asserts empty-state rendering, descending `checked_in_at` sort, and all three method labels.

---

### Task 1: Data model and log service

**Files:**
- Modify: `src/db/models.js` (registration schema, new log schema, exports)
- Create: `src/server/checkin-log.js`
- Test: throwaway assert script in `C:\Users\Windows\AppData\Local\Temp\opencode\checkin-activity-assert.mjs`

**Interfaces:**
- Consumes: `serialize` from `src/db/models.js`; Mongoose `connectDb()` from `src/db/index.js`.
- Produces: `CheckInLog` model exported from `src/db/models.js` but **not** in `MODELS`; `recordCheckInLog({ eventId, registration, method, already, adminId }) -> serialized log`; `listCheckInLogs(eventId, limit = 100) -> serialized log[]` sorted by `created_date` descending.

- [ ] **Step 1: Write the failing assertions**

Create `checkin-activity-assert.mjs` in the temp dir with:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = 'C:/envkit/projects/event-pass';
const models = readFileSync(`${root}/src/db/models.js`, 'utf8');
assert.match(models, /check_in_method:\s*\{[^}]*type:\s*String/);
assert.match(models, /const checkInLogSchema/);
for (const field of ['event_id', 'registration_id', 'method', 'already', 'admin_id', 'created_date']) {
  assert.match(models, new RegExp(`${field}:\\s*\\{`));
}
assert.match(models, /event_id:\s*\{[^}]*index:\s*true/);
assert.match(models, /export const CheckInLog = register\('CheckInLog', checkInLogSchema\)/);
assert.doesNotMatch(models, /export const MODELS = \{[^}]*CheckInLog/);
const svc = readFileSync(`${root}/src/server/checkin-log.js`, 'utf8');
assert.match(svc, /export async function recordCheckInLog/);
assert.match(svc, /export async function listCheckInLogs/);
assert.match(svc, /sort\(\{ created_date: -1 \}\)/);
assert.match(svc, /limit\(limit\)/);
```

- [ ] **Step 2: Run the assertions to verify they fail**

Run: `node C:\Users\Windows\AppData\Local\Temp\opencode\checkin-activity-assert.mjs`
Expected: FAIL (`check_in_method` missing / `checkin-log.js` not found).

- [ ] **Step 3: Implement the model and service**

In `src/db/models.js`: add nullable `check_in_method` next to `checked_in_by`; add `checkInLogSchema` using the existing `id()`/`createdDate`/`options` helpers, index `event_id` and `registration_id`, export `CheckInLog` via `register('CheckInLog', checkInLogSchema)`, and leave `MODELS` untouched.

In `src/server/checkin-log.js`: export the two functions with the signatures above. `recordCheckInLog` creates a row using `registration.id`, `registration.registration_number`, `registration.guest_name`, `registration.guest_email` and returns `serialize(doc)`. `listCheckInLogs` queries `{ event_id: eventId }`, sorts by `created_date` descending, limits, and maps with `serialize`.

- [ ] **Step 4: Run assertions and static checks**

Run: `node C:\Users\Windows\AppData\Local\Temp\opencode\checkin-activity-assert.mjs`, then `npm run lint`, `npm run typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

`git add src/db/models.js src/server/checkin-log.js && git commit -m "feat: add persistent check-in log model and service"`

---

### Task 2: Server write paths

**Files:**
- Modify: `src/server/entity-api.js:106-120, 377-410, 517-551`

**Interfaces:**
- Consumes: `recordCheckInLog` from `src/server/checkin-log.js`.
- Produces: `checkInRegistration(token, user, eventId, method = 'qr_scan')` — logs first and repeat check-ins; `updateEntity` — logs manual-button transitions and strips client `check_in_method`.

- [ ] **Step 1: Add assertions to the temp script**

```js
const api = readFileSync(`${root}/src/server/entity-api.js`, 'utf8');
assert.match(api, /checkInRegistration\(token, user, eventId, method = 'qr_scan'\)/);
assert.match(api, /const CHECKIN_METHODS = new Set\(\['qr_scan', 'manual_entry']\)/);
assert.match(api, /if \(!CHECKIN_METHODS\.has\(method\)\) throw new ApiError\(400/);
assert.match(api, /check_in_method: method/);
assert.match(api, /already: true[\s\S]{0,200}recordCheckInLog/);
assert.match(api, /method: 'manual_button'/);
assert.match(api, /delete out\.check_in_method/);
assert.match(api, /delete payload\.check_in_method/);
assert.match(api, /adminId: user\.id/);
const checkInFn = api.slice(
  api.indexOf('export async function checkInRegistration'),
  api.indexOf('export async function createEntity'),
);
assert.equal((checkInFn.match(/recordCheckInLog\(/g) || []).length, 2);
assert.ok(checkInFn.indexOf("status === 'cancelled'") < checkInFn.indexOf('recordCheckInLog('));
assert.ok(checkInFn.indexOf('already: true') < checkInFn.indexOf('findByIdAndUpdate('));
```

- [ ] **Step 2: Run to verify the new assertions fail**

Run: `node C:\Users\Windows\AppData\Local\Temp\opencode\checkin-activity-assert.mjs`
Expected: FAIL on the new `entity-api.js` assertions.

- [ ] **Step 3: Implement the write paths**

- Import `recordCheckInLog`.
- Define `CHECKIN_METHODS = new Set(['qr_scan', 'manual_entry'])` near `checkInRegistration`; validate `method` with `ApiError(400, ...)`.
- In `checkInRegistration`: add `check_in_method: method` to the `findByIdAndUpdate` payload; call `recordCheckInLog` with `already: true` before the early return for an already-checked-in registration, and with `already: false` after a successful update.
- In `assertRegistrationCreate`: `delete out.check_in_method` alongside the existing `checked_in_at`/`checked_in_by` deletes.
- In `updateEntity`: `delete payload.check_in_method` immediately after `sanitize`. When `entity === 'Registration' && payload.status === 'checked_in'`, load the existing row before the update; if `existing.status !== 'checked_in'`, set `payload.check_in_method = 'manual_button'` **before** `findByIdAndUpdate`, then after a successful update call `recordCheckInLog({ ..., registration: serialize(doc), method: 'manual_button', already: false, adminId: user.id })`.
- Do not log when the update merely restores a cancelled registration or clears check-in state.

- [ ] **Step 4: Run assertions and static checks**

Run: `node C:\Users\Windows\AppData\Local\Temp\opencode\checkin-activity-assert.mjs`, then `npm run lint`, `npm run typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

`git add src/server/entity-api.js && git commit -m "feat: record check-in method and persistent log rows"`

---

### Task 3: Admin GET route, client shim and method constants

**Files:**
- Modify: `app/api/admin/checkin/route.js`, `src/api/db.js`, `src/lib/checkin.js`

**Interfaces:**
- Consumes: `listCheckInLogs` from Task 1.
- Produces: `GET /api/admin/checkin?event_id=... -> { logs: CheckInLog[] }`; `db.checkinLogs.list(eventId) -> CheckInLog[]`; `checkInByQrValue(value, eventId, method = 'qr_scan')`; `CHECKIN_METHOD_LABELS` mapping all three methods to display labels.

- [ ] **Step 1: Add assertions to the temp script**

```js
const route = readFileSync(`${root}/app/api/admin/checkin/route.js`, 'utf8');
assert.match(route, /export async function GET\(request\)/);
assert.match(route, /requireAdmin\(await getSessionUser\(request\)\)/);
assert.match(route, /searchParams\.get\('event_id'\)/);
assert.match(route, /logs: \[\]/);
assert.match(route, /listCheckInLogs\(eventId\)/);

const shim = readFileSync(`${root}/src/api/db.js`, 'utf8');
assert.match(shim, /checkinLogs:/);
assert.match(shim, /admin\/checkin\$\{query\(\{ event_id: eventId \}\)\}/);

const client = readFileSync(`${root}/src/lib/checkin.js`, 'utf8');
assert.match(client, /CHECKIN_METHOD_LABELS/);
assert.match(client, /manual_button:/);
assert.match(client, /checkInByQrValue\(value, eventId, method = 'qr_scan'\)/);
assert.match(client, /method,/);
```

- [ ] **Step 2: Run to verify the new assertions fail**

Run: `node C:\Users\Windows\AppData\Local\Temp\opencode\checkin-activity-assert.mjs`
Expected: FAIL on the new route/shim/client assertions.

- [ ] **Step 3: Implement route, shim and constants**

- In the checkin route, import `requireAdmin` and `listCheckInLogs`; add a `GET` handler that requires an admin, reads `event_id` from `request.url` search params, returns `{ logs: [] }` when it is missing, otherwise `{ logs: await listCheckInLogs(eventId) }`. Leave POST rate limiting unchanged; pass `body?.method` through to `checkInRegistration`.
- In `db.js`, add `checkinLogs: { list: async (eventId) => (await request(...))?.logs || [] }` to the exported `db` object using the route URL above.
- In `src/lib/checkin.js`, export `CHECKIN_METHOD_LABELS` with `qr_scan: 'QR scan'`, `manual_entry: 'Manual entry'`, `manual_button: 'Check-in button'`; add the optional `method` parameter to `checkInByQrValue` and include `method` in the POST body.

- [ ] **Step 4: Run assertions and a shim smoke check**

Run: `node C:\Users\Windows\AppData\Local\Temp\opencode\checkin-activity-assert.mjs`, then `npm run lint`, `npm run typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

`git add app/api/admin/checkin/route.js src/api/db.js src/lib/checkin.js && git commit -m "feat: expose persistent check-in logs through admin API and db shim"`

---

### Task 4: Scanner supplies the method

**Files:**
- Modify: `src/views/admin/AdminCheckIn.jsx:40-83, 93-133, 278-284, 372-390`

**Interfaces:**
- Consumes: `CHECKIN_METHOD_LABELS`, `checkInByQrValue(value, eventId, method)` from Task 3.
- Produces: `enqueueCheckIn(value, method)` queue items and local history entries carrying `method`.

- [ ] **Step 1: Add assertions to the temp script**

```js
const scan = readFileSync(`${root}/src/views/admin/AdminCheckIn.jsx`, 'utf8');
assert.match(scan, /enqueueCheckIn\(hit\.text, "qr_scan"\)/);
assert.match(scan, /enqueueCheckIn\(value, "manual_entry"\)/);
assert.match(scan, /checkInByQrValue\(token, eventId, method\)/);
assert.match(scan, /queueRef\.current\.push\(\{ token, method \}\)/);
assert.match(scan, /item\.token === token/);
assert.match(scan, /already: data\.already, at: new Date\(\), method/);
assert.match(scan, /CHECKIN_METHOD_LABELS\[h\.method\]/);
```

- [ ] **Step 2: Run to verify the new assertions fail**

Run: `node C:\Users\Windows\AppData\Local\Temp\opencode\checkin-activity-assert.mjs`
Expected: FAIL on the new scanner assertions.

- [ ] **Step 3: Implement the method-aware queue**

Change queue items from tokens to `{ token, method }` and update every consumer: `drainQueue` destructures the item and passes the method to `checkInByQrValue`; `activeRef` still holds the token; dedupe and the queue-full check compare `item.token`; history entries include `method`. Camera decoding calls `enqueueCheckIn(hit.text, "qr_scan")`, `handleManual` calls `enqueueCheckIn(value, "manual_entry")`. Add the method label to the existing "Recent scans" row. Do not change camera lifecycle or the progress dialog.

- [ ] **Step 4: Run assertions and static checks**

Run: `node C:\Users\Windows\AppData\Local\Temp\opencode\checkin-activity-assert.mjs`, then `npm run lint`, `npm run typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

`git add src/views/admin/AdminCheckIn.jsx && git commit -m "feat: label QR and manual-entry scans with their method"`

---

### Task 5: Activity modal and toolbar button

**Files:**
- Create: `src/components/CheckInActivityDialog.jsx`
- Modify: `src/views/admin/AdminRegistrations.jsx:169-196, 705-755, 1067-1073`

**Interfaces:**
- Consumes: `db.checkinLogs.list(eventId)` (Task 3), `CHECKIN_METHOD_LABELS` (Task 3), `regs` from `AdminRegistrations`.
- Produces: default-exported `CheckInActivityDialog({ open, onOpenChange, eventId, eventName, regs })`.

- [ ] **Step 1: Add assertions to the temp script**

```js
const dialog = readFileSync(`${root}/src/components/CheckInActivityDialog.jsx`, 'utf8');
assert.match(dialog, /db\.checkinLogs\.list\(eventId\)/);
assert.match(dialog, /status === 'checked_in'/);
assert.match(dialog, /new Date\(b\.checked_in_at\) - new Date\(a\.checked_in_at\)/);
assert.match(dialog, /created_date/);
for (const label of ['Checked-in guests', 'Scan log']) assert.ok(dialog.includes(label));
assert.match(dialog, /CHECKIN_METHOD_LABELS/);
assert.match(dialog, /No checked-in guests yet/);
assert.match(dialog, /No scans recorded yet/);

const page = readFileSync(`${root}/src/views/admin/AdminRegistrations.jsx`, 'utf8');
assert.match(page, /setActivityOpen\(true\)/);
assert.match(page, /<CheckInActivityDialog/);
```

- [ ] **Step 2: Run to verify the new assertions fail**

Run: `node C:\Users\Windows\AppData\Local\Temp\opencode\checkin-activity-assert.mjs`
Expected: FAIL on the new dialog/page assertions.

- [ ] **Step 3: Implement the dialog**

Use the existing `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` and `Button` components with two local tab buttons (no new UI dependency). Fetch `db.checkinLogs.list(eventId)` each time the dialog opens and expose loading/fetch errors inline; no polling or live refresh. Derive the guests tab from `regs.filter(r => r.status === 'checked_in').sort(...)` by `checked_in_at` descending; render guest name/email, registration number, `formatDateTime(checked_in_at)` and the method label from `reg.check_in_method` (fallback to `Check-in button` for older rows). Render the log tab from fetched entries sorted as returned, showing time, guest, registration number, method label and an "already in" badge. Include both empty states. Keep the list scrollable inside the dialog.

- [ ] **Step 4: Wire the toolbar**

Add `activityOpen` state to `AdminRegistrations`, an "Activity" button in both the mobile and desktop toolbar groups (icon + label on desktop, icon-only with `aria-label` on mobile), and render `<CheckInActivityDialog open={activityOpen} onOpenChange={setActivityOpen} eventId={eventId} eventName={event?.name} regs={regs || []} />` alongside the existing dialogs. Do not change the mobile Scan QR dialog or the desktop scanner column.

- [ ] **Step 5: Run assertions, static checks and build**

Run: `node C:\Users\Windows\AppData\Local\Temp\opencode\checkin-activity-assert.mjs`, then `npm run lint`, `npm run typecheck`, `npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

`git add src/components/CheckInActivityDialog.jsx src/views/admin/AdminRegistrations.jsx && git commit -m "feat: add check-in activity modal with guests and scan-log tabs"`
