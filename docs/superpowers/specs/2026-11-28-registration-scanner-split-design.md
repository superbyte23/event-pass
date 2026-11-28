# Event registration page: split scanner + table

## Intent
Staff checking in attendees at a specific event should keep the scanner and the
registration list on screen together. The scanner should not open as a dialog on
desktop; on a phone the dialog is still the workable pattern.

## Goals
- On `md` screens and wider, show a two-column page: QR scanner 40% (left),
  registration table 60% (right).
- Keep the scanner event-scoped and keep refreshing the table after a scan.
- On screens below `md`, keep the existing mobile card list and a “Scan QR”
  button that opens the scanner in a dialog.

## Non-goals / anti-goals
- Global `/admin/checkin` keeps its current full-page layout and behavior.
- No API, server, data-model, or dependency changes.
- The per-scan `CheckInProgressDialog` stays a dialog; it shows scan results,
  not the scanner.
- Do not make the table cramped enough to lose its horizontal scrolling.

## Constraints
- `AdminCheckIn` currently renders its own `md:grid-cols-2` camera/result grid,
  which is too wide for a 40% column. It needs a `compact` flag (default false)
  that collapses that inner grid to one column.
- Tailwind `md:` is viewport-based, not container-based, so the compact flag
  must be explicit rather than relying on breakpoint behavior inside the column.

## Approaches
1. **Chosen — 40/60 split, compact scanner, mobile modal.** Wrap the existing
   table card and a new inline scanner in `md:grid md:grid-cols-5`, scanner
   `md:col-span-2`, table `md:col-span-3`. The scanner is `hidden md:block`; the
   desktop “Scan QR” button and dialog are removed, the mobile button/dialog
   stay. `AdminCheckIn({ compact })` stacks camera and result in the narrow
   column. Best balance: table keeps most of the width, global page untouched.
2. **50/50 split, scanner unchanged.** No component change, but camera/result
   each get ~250px and the table loses half the viewport. Rejected.
3. **Toggleable inline panel.** Smallest diff but still a show/hide step, not
   the always-visible two-column page asked for. Rejected.

## Builder's remaining calls
- Keep the existing filter bar and toolbar above the two-column area.
- Verify with source assertions (no test framework in repo), `npm run lint`,
  `npm run typecheck`, and `npm run build`.
