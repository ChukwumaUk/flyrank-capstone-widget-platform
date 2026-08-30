# Embeddable Widget & Lead-Capture Platform

A platform for creating embeddable lead-capture widgets — signup forms, CTAs,
popovers — delivering them via a one-line `<script>` snippet, and safely accepting
submissions from the public internet: validated, rate-limited, spam-filtered,
geo-enriched, and shown to the widget's owner in a dashboard.

Unlike a typical CRUD app, this service receives requests directly from browsers on
websites it does not control. That single fact drives the whole design: the
submission path trusts nothing it receives.

**FlyRank Backend Track — Capstone.** Built with Node.js, Express, TypeScript, and
PostgreSQL, using Supabase Auth as the identity provider.

## Architecture — three request paths

The system is organized around three actors at three trust levels. Keeping them
separate is the core of the design.

```
Owner (authenticated)
  └─► Widget Management API ─► Widgets DB (tenant-isolated) ─► embed snippet

Customer website (any origin)
  └─ <script src="/widget.js?id=abc123">
       └─► GET /widgets/:id/config   (public · cached · projection only)
       └─► renders the widget form

Website visitor (public, cross-origin)
  └─► POST /submissions   (public · CORS · hardened):
        CORS + preflight  → allowed origin only
        size limit        → 413 on oversized body
        rate limit        → 429 per-IP flood protection
        validation        → 400 on malformed input
        widget existence  → 404 if no such widget
        spam honeypot     → silent drop of bots
        geo enrichment    → provider A → provider B → null (degrade, never fail)
        store submission
        safe notification → failure never blocks the submission
```

- **Owner path** — authenticated (Supabase Auth), tenant-isolated widget CRUD +
  dashboard. Every query is scoped by `owner_id`.
- **Delivery path** — public, cached config endpoint + the embeddable widget script.
- **Submission path** — zero-trust. The client is the entire internet.

### Layers

Each concern is separated: `routes` (HTTP) → `service` (business logic) →
`repository` (SQL) → `types`. Swapping the database or a provider touches only its
layer, not the business logic.

## Requirements

- Docker and Docker Compose
- A free Supabase project (for owner authentication) — no credit card required

## Setup & run


1. Create a free project at [supabase.com](https://supabase.com). From
   **Project Settings → API**, copy your **Project URL** and **anon key**. In
   **Authentication → Sign In / Providers → Email**, turn **Confirm email OFF**
   (so a fresh signup can log in immediately).

2. Copy the example env file and fill in your Supabase values:

```bash
   cp .env.example .env
   # then edit .env and set SUPABASE_URL and SUPABASE_KEY
```

3. Start the whole stack — app + PostgreSQL, with database migrations applied
   automatically on startup:

```bash
   docker compose up --build
```

   The API is now at http://localhost:3000.

   Note: docker compose up --build downloads dependencies; on a slow connection the npm install step may need a retry (ECONNRESET). The build is deterministic and completes once the download succeeds.

4. Seed a demo widget (idempotent — safe to run twice). It prints an embed snippet
   you can paste into any page:

```bash
   npm run seed
```

5. See the widget live on a *different origin* (the "customer site"):

```bash
   npx serve customer-site -l 5500
```

   Open http://localhost:5500 — the widget renders on a page it doesn't own, and
   submitting it POSTs cross-origin through the hardened chain.

## Tests

```bash
npm test
```

A deterministic suite (vitest + supertest) covering the scary cases: input
validation, widget-existence 404, the spam honeypot (stores nothing), rate limiting
(429 under a burst), and geo-enrichment degrading to null without failing the
submission. External dependencies (database, Supabase, geo providers) are mocked so
tests are fast and repeatable.

## API reference

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/auth/signup` | – | Register an owner |
| POST | `/auth/login` | – | Log in, returns a JWT |
| POST | `/api/widgets` | Bearer | Create a widget |
| GET | `/api/widgets` | Bearer | List my widgets |
| GET | `/api/widgets/:id` | Bearer | Get one of my widgets |
| PATCH | `/api/widgets/:id` | Bearer | Update a widget |
| DELETE | `/api/widgets/:id` | Bearer | Delete a widget |
| GET | `/api/widgets/:id/submissions` | Bearer | List a widget's submissions (dashboard) |
| GET | `/api/widgets/:id/stats` | Bearer | Submission stats — total + by country |
| GET | `/widgets/:id/config` | – (cached) | Public widget config for rendering |
| GET | `/widget.js` | – | The embeddable widget script |
| POST | `/submissions` | – (CORS) | Public, hardened submission endpoint |
| OPTIONS | `/submissions` | – | CORS preflight |

**Status codes:** 200 / 201 success · 204 delete · 400 invalid input ·
401 unauthenticated · 404 not found or cross-tenant · 413 payload too large ·
429 rate limited.

## Security & resilience highlights

- **Tenant isolation** — every owner query is scoped by `owner_id`, enforced in the
  SQL, not the UI. Cross-tenant access returns **404, not 403**, so existence isn't
  leaked to another tenant.
- **Identity from the token** — `owner_id` always comes from the verified Supabase
  token, never from the request body.
- **Public config is a projection** — `toPublicConfig` whitelists only the fields the
  script needs; internal fields (`owner_id`, `allowed_origins`, timestamps) never
  reach the public.
- **Degrade, never fail** — geo-enrichment tries two independent providers with
  2-second timeouts and falls back to `null`; the confirmation notification is a
  safe side effect. Neither can break a submission — the lead is always stored.
- **Abuse resistance** — per-IP rate limiting (429) and a honeypot spam trap that
  silently drops bots (fake 201, stores nothing) so attackers learn nothing.
- **Secrets** — Supabase keys live in `.env` (git-ignored); `.env.example` documents
  the required variables with placeholders. No secret is committed.

## Limitations (deliberate scope choices)

This is a backend capstone graded on correctness, resilience, and security; the
following were consciously left out of scope:

- **Widget rendering** appends the form to `document.body`. A production version
  would render at the script tag's location or into a customer-specified target
  element.
- **The widget script is served unminified**, with a short cache. Production would
  ship a minified, versioned bundle (e.g. `widget.v2.js`) cached long, busting on
  release.
- **CORS on `/submissions` is currently permissive** (reflects any origin).
  Production would enforce each widget's `allowed_origins` allow-list.
- **The database port is published to the host** for local tooling convenience
  (seed script, psql). A production deployment would not expose it.
- **Notifications and email** are a mocked side effect (logged, not sent). What's
  proven is that their failure never breaks a submission; wiring a real provider is
  a drop-in at the notify layer.
- **Per-widget field validation** — submissions are structurally validated, but not
  yet checked field-by-field against each widget's configured fields. The structural
  layer is in place; dynamic per-widget schemas would build on it.
- **No form-builder / polished frontend** — the explicit non-goal. The widget and
  dashboard UIs are intentionally minimal.

## Project structure

```
src/
  app.ts            Express app (routes mounted; imported by tests)
  index.ts          entry point — runs migrations, then starts the server
  db.ts             Postgres pool
  migrate.ts        migration runner (also runs on startup)
  seed.ts           demo-widget seed
  supabaseClient.ts Supabase Auth client
  middleware/       requireAuth (verifies Supabase JWT)
  widgets/          owner CRUD, config projection, schema, types
  submissions/      hardened submission path: cors, rateLimit, geo, notify,
                    schema, service, repository, tests
migrations/         SQL schema (001_init.sql)
public/             widget.js (the embeddable script)
customer-site/      a plain HTML "customer website" on a second origin
```

## License

MIT