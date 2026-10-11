# AGENTS.md

## Project Context

A Next.js 15 (App Router) deployment of an event registration app, migrated from Base44. All original pages/components and `react-router` routing are unchanged; only the injected Base44 `db` shim was replaced. Treat it as user-owned application code: keep changes focused on the request and preserve existing conventions.

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
