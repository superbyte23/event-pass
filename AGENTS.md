# AGENTS.md

## Project Context

A Next.js 16 (App Router, React 19) deployment of an event registration app, migrated from Base44. All original pages/components and `react-router` routing are unchanged; only the injected Base44 `db` shim was replaced. Treat it as user-owned application code: keep changes focused on the request and preserve existing conventions.

Start with `README.md` for setup, environment variables, and architecture.

## Key Files

- `app/[[...slug]]/page.jsx` + `app/layout.jsx`: SPA shell hosting `src/App.jsx` (client-only, `next/dynamic` with `ssr: false`).
- `app/api/**/route.js`: Next.js route handlers the client shim calls.
- `src/api/db.js`: fetch-based replacement for the Base44 `db` shim — the contract the whole app codes against.
- `src/server/`: `session.js` (JWT cookie reader), `entity-api.js` (port of Base44 RLS rules), `auth-options.js` (NextAuth config: Google + admin credentials).
- `src/db/models.js` + `src/db/index.js`: Mongoose models — source of truth for entity fields; mirror any change in `src/server/entity-api.js` whitelists. `connectDb()` is lazy so `next build` never needs env.
- `.env.local`: local-only environment values; never commit secrets. Template in `.env.example`.

## Working Notes

- `package.json` has `"type": "module"` — config files must be ESM (`next.config.mjs`), never `module.exports` in new `.js` configs.
- Database is MongoDB (Mongoose). Run `npm run dev` for local work; `npm run db:seed` when seed data changes. Schema lives in code (`src/db/models.js`), no migration step.
- The `db` shim must stay the only data-access entry point for views/components — do not introduce direct fetches or other SDK paths in `src/views` or `src/components`.
- Server errors must return JSON `{ message }` with a proper HTTP status; the client reads `e.message` and `e.status`.
- Do not trust client-supplied `user_id` on registrations — the server resolves it from the session (or null for guests).
- Run `npm run lint` and `npm run typecheck` before finishing code changes; `npm run build` must stay green and must not require env vars.
- Baseline status (2026-11-24): `npm run lint`, `npm run typecheck`, and `npm run build` all pass with no warnings. ESLint uses Next 16's native flat config; Next-only Link/Image rules are off because the app uses a react-router SPA shell and a custom image wrapper, and the React Compiler-era hooks rules are off because the app still uses effect-based data loading. UI `React.forwardRef` wrappers carry a JSDoc render-function type, optional component props have defaults, and client errors that add `status`/`data` use an `ApiError` typedef; keep those conventions when editing shared components.
- Dependency notes: `@vercel/blob` is pinned to 2.4.0 (later versions add an OIDC dependency with open advisories); the app only uses `put()` with `BLOB_READ_WRITE_TOKEN`. `nodemailer` stays on 7.x because NextAuth 4's optional peer caps it at `^7.0.7`; upgrading breaks plain `npm install`. Revisit both when upstream ships fixed versions.
