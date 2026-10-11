# Event Pass

A self-hosted event registration and ticketing app: publish events, take guest or account registrations, issue QR tickets, and check attendees in.

Originally a Base44 app; it now runs as a standalone Next.js (App Router) application on Vercel, with MongoDB via Mongoose and Auth.js sign-in (Google plus an admin email/password option). All original pages, components, and `react-router` routing are unchanged — only the Base44 `db` shim was swapped for fetch calls against Next.js route handlers.

## Stack

- **Framework**: Next.js 15 (App Router), single catch-all route (`app/[[...slug]]`) hosting the existing React SPA
- **Database**: MongoDB + Mongoose (`src/db/models.js`)
- **Auth**: Auth.js / NextAuth v4, Google provider + admin credentials, JWT sessions (`src/server/auth-options.js`)
- **File storage**: Vercel Blob (`app/api/uploads/route.js`)

## Setup

```bash
npm install
cp .env.example .env.local # then fill in values
# start a local MongoDB (mongod) on the MONGODB_URI host/port
npm run db:seed            # optional: admin users + a sample event
npm run dev                # http://localhost:3000
```

## Environment variables

Copy `.env.example` to `.env.local`:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string (defaults to `mongodb://127.0.0.1:27017/event_pass`) |
| `AUTH_SECRET` | NextAuth JWT secret (`npx auth secret`) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client credentials (redirect URI: `http://localhost:3000/api/auth/callback/google` locally; your production origin in prod) |
| `ADMIN_EMAILS` | Comma-separated accounts granted the admin role; also usable for admin sign-in |
| `ADMIN_PASSWORD` | Shared password for the admin email/password sign-in (empty disables it) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token for uploads (auto-provided on Vercel) |

## Architecture

```
app/
  [[...slug]]/page.jsx        SPA shell — renders src/App.jsx (client only)
  layout.jsx
  api/
    [...nextauth]/route.js    NextAuth (Google + admin credentials)
    auth/me/route.js          current session user
    entities/[entity]/        entity CRUD (list/filter/create/update/delete)
    entities/[entity]/[id]/
    public-settings/route.js
    uploads/route.js          Vercel Blob uploads
src/
  App.jsx, views/, components/   existing app (unchanged)
  api/db.js                      the Base44 `db` shim, now fetch-based
  server/                        session reader, entity API, auth options
  db/models.js                   Mongoose models (users/events/registrations/settings)
  db/index.js                    lazy mongoose connection (connectDb)
```

### Authorization

Entity rules mirror the original Base44 RLS definitions:

- **Event**: read = published (admins see all); write = admin only.
- **Registration**: reads require admin (all rows), sign-in (own rows only), or — for guest ticket links — knowledge of the id; anyone may create a registration (server forces `user_id` to the session user or null); updates/deletes are admin only.
- **User**: self or admin read; admin write.
- **Setting**: public read; admin write.

Errors are returned as JSON `{ message }` with the matching HTTP status so the existing `catch` blocks (which read `e.message` / `e.status`) keep working.

## Development

```bash
npm run dev         # Next.js dev server
npm run build       # production build
npm run start       # serve the production build
npm run lint        # eslint (flat config, errors only)
npm run lint:fix    # eslint --fix
npm run typecheck   # tsc over the jsconfig includes (pre-existing errors only)
```

## Deploy

Push to a Vercel project. Set the environment variables above (`MONGODB_URI` pointing at MongoDB Atlas or another reachable cluster), point Google OAuth at your production callback URL, run `npm run db:seed` against the production database once, and grant yourself admin via `ADMIN_EMAILS`.
