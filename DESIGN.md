# Design — Embeddable Widget & Lead-Capture Platform

## 1. What this system is

A platform that lets an authenticated customer (an "owner") create embeddable
lead-capture widgets — signup forms, CTAs, popovers — and install them on any
website with a single `<script>` tag. When a visitor submits the widget's form,
the submission travels back to this backend, where it is validated, protected
against abuse, enriched with location data, stored, and shown to the widget's
owner in a dashboard.

The defining constraint: this application receives requests directly from browsers
on websites we do not control. The client is the public internet, so the
submission path trusts nothing it receives.

### Explicit non-goal

No visual form-builder and no polished frontend. Widgets render as a minimal HTML
form; the dashboard is API endpoints plus a plain table. This is a backend
capstone — the work lives in the submission path's correctness, resilience, and
security, not in UI.

## 2. The three request paths

The whole system is three actors hitting three kinds of endpoint at three trust
levels. Keeping them separate is the core of the design.

| Path | Actor | Trust posture |
|------|-------|---------------|
| Owner API (private) | Authenticated customer managing their own widgets | "I know who you are; you may only touch your own data." |
| Delivery (public, cached) | A customer's website loading the script + config | "Public, but read-only and cacheable; no secrets here." |
| Submission (public, CORS, hardened) | A visitor submitting the form from a site we don't control | Zero trust. Validate, rate-limit, spam-filter everything. |

Every design decision traces back to: *which path is this, and what do I trust here?*

## 3. Data model

Two core tables. Owner identity comes from Supabase Auth (reused from the auth
assignment), so `owner_id` is a Supabase user UUID — no local users table needed.

```sql
create table widgets (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null,                 -- Supabase user id (tenant key)
  type            text not null,                 -- 'signup' | 'cta' | 'popover'
  title           text not null,
  description     text,
  config          jsonb not null default '{}',   -- fields, button text, display options
  allowed_origins text[],                         -- null = any; else sites allowed to embed
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table submissions (
  id          bigserial primary key,
  widget_id   uuid not null references widgets(id) on delete cascade,
  data        jsonb not null,                    -- the validated form values
  ip_address  inet,                              -- nullable; PII (see decisions)
  country     text,                              -- nullable: geo enrichment may be absent
  city        text,                              -- nullable: "degrade, never fail"
  created_at  timestamptz not null default now()
);

create index idx_widgets_owner on widgets(owner_id);
create index idx_submissions_widget on submissions(widget_id);
create index idx_submissions_created on submissions(created_at);
```

Key decisions:

- **`widgets.id` is a UUID, not a serial integer.** It appears in a public URL
  (`?id=abc123`). A sequential id would be enumerable — anyone could walk 1, 2, 3
  and harvest every widget. Anything exposed publicly gets a non-guessable id.
- **`config` is JSONB, not columns.** Different widget types have different fields.
  Structured columns are used for what we query or secure on (`id`, `owner_id`,
  `type`); JSONB holds the flexible, owner-defined config we only ever store and
  serve whole.
- **Geo columns are nullable on purpose.** If every geo provider is down, the
  submission still stores with `null` geo. The nullability encodes the
  "degrade, never fail" rule in the schema itself.
- **`on delete cascade`** on the submission FK: deleting a widget removes its
  submissions, so no orphaned rows.

## 4. Tenant isolation (security spine)

Every owner-facing query is scoped by `owner_id`, enforced in the query layer —
never assumed from the UI. "Get widget X" is always "get widget X **where
owner_id = the authenticated caller**." Without the scope, one owner could read or
edit another's widget by guessing its id.

- `owner_id` is always taken from the verified Supabase token, never from the
  request body — identity is never client-supplied.
- Submissions inherit isolation through their widget:
  `submissions JOIN widgets ON submissions.widget_id = widgets.id
   WHERE widgets.owner_id = me`.
- Cross-tenant access returns **404, not 403** — 403 would confirm the resource
  exists and leak information. "As far as you're concerned, it doesn't exist."

## 5. API surface

### Path 1 — Owner API (authenticated; prefix `/api`)

| Method | Route | Purpose | Status codes |
|--------|-------|---------|--------------|
| POST | /api/widgets | Create a widget (owner_id from token) | 201, 400, 401 |
| GET | /api/widgets | List my widgets | 200, 401 |
| GET | /api/widgets/:id | Get one of my widgets | 200, 401, 404 |
| PATCH | /api/widgets/:id | Update it | 200, 400, 401, 404 |
| DELETE | /api/widgets/:id | Delete it | 204, 401, 404 |
| GET | /api/widgets/:id/submissions | Dashboard: list submissions | 200, 401, 404 |
| GET | /api/widgets/:id/stats | Analytics: counts over time, geo | 200, 401, 404 |

### Path 2 — Delivery (public, cached, read-only)

| Method | Route | Purpose | Caching |
|--------|-------|---------|---------|
| GET | /widget.js (versioned) | The script bundle the `<script>` loads | Long — versioned URL busts cache on release |
| GET | /widgets/:id/config | Public config the script renders from | Short (~60s) |

The `/config` response is a **projection** — only what the script needs to render
(type, title, fields, button text, display options). Internal columns
(`owner_id`, `allowed_origins`, timestamps) are never exposed to the public.

### Path 3 — Submission (public, cross-origin, hardened)

| Method | Route | Purpose | Status codes |
|--------|-------|---------|--------------|
| OPTIONS | /submissions | CORS preflight | 204 + CORS headers |
| POST | /submissions | Validate → protect → enrich → store | 201, 400, 413, 429 |

Each code is a defense: 400 malformed payload, 413 oversized body, 429 rate-limit
flood, 201 success — and success holds even if geo enrichment or the confirmation
email failed, because those are non-critical side effects.

## 6. The embed flow

1. Owner creates a widget (`POST /api/widgets`) → API returns the snippet:
   `<script src="https://your-api/widget.js?id=abc123"></script>`
2. The owner pastes that one line into any website.
3. A visitor loads the page → browser fetches `/widget.js` (cached).
4. The script reads its own `?id=abc123` and calls `GET /widgets/abc123/config`.
5. The script renders the form into the page.
6. The visitor submits → the script POSTs to `/submissions` (cross-origin, hardened).
7. The backend runs the defense chain, stores the row → the owner sees it via
   `GET /api/widgets/abc123/submissions`.

## 7. Decisions made during the build

- **Idempotency key** on submissions — considered, but not added. The widget
  submission path is naturally low-stakes on retries (a duplicate lead is a minor,
  recoverable issue, unlike a duplicate payment), so per the "don't gold-plate"
  guidance it was left out. Noted as a possible enhancement.
- **IP address privacy** — the raw `ip_address` is stored (nullable). It's needed
  for rate limiting and geo-enrichment. A production system might hash it or drop it
  after enrichment; this tradeoff is noted in the README's limitations.