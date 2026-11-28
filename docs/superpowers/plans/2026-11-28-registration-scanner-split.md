# Registration Scanner Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put a compact QR scanner and the registration table side by side (40/60) on desktop, keeping the mobile dialog.

**Architecture:** `AdminCheckIn` gains a `compact` flag that collapses only its internal camera/result grid; the registration page wraps the scanner and existing table card in a 5-column grid (`2/3`) at `md` and up, and keeps the existing mobile Scan QR button + dialog below `md`. Global `/admin/checkin` passes no flag and is unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 3, lucide-react; no test framework (assert-based source checks).

**Spec:** `docs/superpowers/specs/2026-11-28-registration-scanner-split-design.md`

## Global Constraints

- Keep the global `/admin/checkin` layout and behavior unchanged.
- Keep the check-in API, server event scoping, and `onCheckedIn` refresh wiring unchanged.
- No new dependencies.
- Run `npm run lint` and `npm run typecheck` before each commit; `npm run build` must stay green without env vars.

## Review Focus

- Desktop at ~1024px: scanner column must not squash camera/result side by side — pinned by Task 1's assertion that the inner grid is single-column when `compact`.
- Mobile below `md`: inline scanner hidden, mobile Scan QR button opens the dialog — pinned by Task 2's assertions.
- Global `/admin/checkin`: no `compact` prop, inner grid still `md:grid-cols-2` — pinned by Task 1's assertion on the default.
- Successful inline scan still refreshes the table — pinned by Task 2's assertion that `onCheckedIn={refreshRegs}` is passed to the inline scanner.
- Closing the mobile dialog stops the camera — pinned by Task 2's assertion that `<AdminCheckIn>` stays conditionally rendered inside the dialog.

---

### Task 1: Compact scanner layout

**Files:**
- Modify: `src/views/admin/AdminCheckIn.jsx:20`, `:322`

**Interfaces:**
- Consumes: existing `eventId`, `onCheckedIn` props and the imported `cn` helper.
- Produces: `AdminCheckIn({ eventId = undefined, onCheckedIn = undefined, compact = false })`; when `compact` is true the camera/result grid renders one column instead of `md:grid-cols-2`.

- [ ] **Step 1: Write the failing source assertion** at `%TEMP%/opencode/checkin-compact-check.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync('C:/envkit/projects/event-pass/src/views/admin/AdminCheckIn.jsx', 'utf8');
assert.match(src, /compact = false \}/);
assert.match(src, /cn\("grid gap-6", !compact && "md:grid-cols-2"\)/);
assert.ok(!src.includes('<div className="grid gap-6 md:grid-cols-2">'));
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node C:/Users/Windows/AppData/Local/Temp/opencode/checkin-compact-check.mjs`
Expected: FAIL on the `compact = false` assertion.

- [ ] **Step 3: Add the `compact` prop**

Change the component signature to `AdminCheckIn({ eventId = undefined, onCheckedIn = undefined, compact = false })` and the inner grid wrapper to `<div className={cn("grid gap-6", !compact && "md:grid-cols-2")}>`. Keep all other markup unchanged.

- [ ] **Step 4: Run the assertion and quality gates**

Run: `node C:/Users/Windows/AppData/Local/Temp/opencode/checkin-compact-check.mjs` → PASS; then `npm run lint` and `npm run typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/views/admin/AdminCheckIn.jsx
git commit -m "feat: compact scanner layout for embedded use"
```

### Task 2: Desktop split layout, mobile dialog

**Files:**
- Modify: `src/views/admin/AdminRegistrations.jsx:732-737`, `:844`, `:1010-1011`

**Interfaces:**
- Consumes: `AdminCheckIn({ eventId, onCheckedIn, compact })` from Task 1; existing `refreshRegs`, `scanOpen`, `eventId`, and the existing `<Card>` table/mobile-view block.
- Produces: desktop two-column layout with the inline scanner at `md:col-span-2` and the table card at `md:col-span-3`.

- [ ] **Step 1: Write the failing source assertion** at `%TEMP%/opencode/registrations-split-check.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync('C:/envkit/projects/event-pass/src/views/admin/AdminRegistrations.jsx', 'utf8');
assert.match(src, /md:grid md:grid-cols-5 md:items-start md:gap-6/);
assert.match(src, /hidden md:col-span-2 md:block/);
assert.match(src, /<AdminCheckIn eventId=\{eventId\} onCheckedIn=\{refreshRegs\} compact \/>/);
assert.match(src, /md:col-span-3/);
assert.ok(!/<Button size="sm" onClick=\{\(\) => setScanOpen\(true\)\}><ScanLine/.test(src));
assert.match(src, /<Button size="sm" onClick=\{\(\) => setScanOpen\(true\)\} aria-label="Scan QR">/);
assert.match(src, /\{scanOpen && <AdminCheckIn eventId=\{eventId\} onCheckedIn=\{refreshRegs\} \/>}/);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node C:/Users/Windows/AppData/Local/Temp/opencode/registrations-split-check.mjs`
Expected: FAIL on the grid assertion.

- [ ] **Step 3: Wire the layout**

Wrap the existing `<Card>` table block in `<div className="md:grid md:grid-cols-5 md:items-start md:gap-6">` with a `hidden md:col-span-2 md:block` first child containing `<AdminCheckIn eventId={eventId} onCheckedIn={refreshRegs} compact />`, and a `md:col-span-3` second child containing the unchanged `<Card>`. Remove only the desktop “Scan QR” button from the desktop toolbar; keep the mobile “Scan QR” button and the conditional dialog exactly as they are.

- [ ] **Step 4: Run the assertion and quality gates**

Run: `node C:/Users/Windows/AppData/Local/Temp/opencode/registrations-split-check.mjs` → PASS; then `npm run lint`, `npm run typecheck`, `npm run build` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/views/admin/AdminRegistrations.jsx docs/superpowers/specs/2026-11-28-registration-scanner-split-design.md docs/superpowers/plans/2026-11-28-registration-scanner-split.md
git commit -m "feat: split registration page into scanner and table columns"
```
