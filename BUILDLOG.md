# Build Log

A running journal of decisions, problems, fixes, and where AI assisted.

## How this was built
Built with AI assistance (Claude) in a teacher-student format: each concept and
line was explained before I wrote it, so I understand and own every part. I can
explain any decision or line in this repo. Where AI drafted boilerplate (config,
scaffolding, docs), I reviewed it, understood it, and adjusted it to my project.

## Phase 0 — Setup
- Created a fresh public repo with a README skeleton, .gitignore, MIT license, and
  submission-pack stubs (BUILDLOG, EVIDENCE, capstone.yaml) as the first commit.
- Decided to build in TypeScript rather than plain JS, for type-safe boundaries and
  a production-grade portfolio piece (TS is already part of my stack).

## Phase 1 — Design
- Wrote DESIGN.md: data model (widgets + submissions), the three request paths
  (owner / delivery / submission), the API surface, the embed flow, and one
  explicit non-goal (no visual form-builder / polished frontend).
- Key design decisions: UUID public ids (non-enumerable), JSONB for flexible widget
  config, nullable geo columns to encode "degrade, never fail", tenant isolation
  enforced in the query layer with 404 (not 403) for cross-tenant access.

## Phase 2 — Owner API foundation
- Set up the TypeScript toolchain (tsconfig, tsx for dev, tsc/node for build) and a
  Dockerized Postgres with a healthcheck. Verified with a /health check that the
  whole stack connects.
- Wrote the first migration (001_init.sql) creating the widgets and submissions
  tables. Made it idempotent with `if not exists` — running it twice is a safe no-op.
- Built POST /api/widgets across a layered architecture: route (HTTP) → service
  (logic) → repository (SQL) → types. Validation with Zod at the boundary; a bad
  payload gets a 400 and never reaches the service or DB.
- Added Supabase auth (fresh project). Wrote a typed requireAuth middleware and
  extended Express's Request type (declaration merging in express.d.ts) so req.user
  is type-safe.

### Problems & fixes
- **500 on the no-token request.** requireAuth was imported but not applied on the
  mount (`app.use("/api/widgets", widgetsRouter)` was missing the middleware).
  Fixed by adding it: `app.use("/api/widgets", requireAuth, widgetsRouter)`.
  Learned that `req.user!.id` trusts the middleware wiring — a missing guard turns
  the non-null assertion into a runtime crash instead of a clean 401.
- **curl (3) URL rejected errors.** Stray backslashes/line-breaks mangled a
  multi-line curl so the token never made it into the header. Fixed by using
  single-line curls and storing tokens in shell variables ($TOKEN1, $TOKEN2).

### Tenant isolation — proven
- Built tenant-scoped CRUD (list / get / update / delete), where owner_id is a WHERE
  clause in every query, not a post-fetch check. Function names encode it
  (findWidgetByIdForOwner, deleteWidgetForOwner) so there's no unscoped version to
  call by accident.
- Proved isolation with two Supabase users: owner 2 gets [] on list and 404 on
  owner 1's widget id — because the query filters by owner_id, so another tenant's
  rows are never returned. 404 (not 403) so existence isn't leaked.

## AI usage summary

Claude guided this build in a teacher-student format — explaining each concept and every line before I wrote it, so I understand and can defend the whole system. I wrote and ran all the code, and debugged every problem myself with guidance (the middleware-mount 500, the invalid-UUID test data, the test-pollution 429, the Docker Node-22/tsconfig/npm-timeout issues). AI was most valuable for explaining new concepts (CORS/preflight, declaration merging, multi-stage Docker builds) and for boilerplate config I reviewed and adapted; least needed for the CRUD/SQL and layered-architecture patterns, which I already knew from earlier assignments.

## CORS

Wired CORS on /submissions via the cors library; verified preflight (OPTIONS → 204 with Allow-Origin/Methods/Headers) and the real POST both carry the right headers. Currently permissive (origin: true) — to be tightened to per-widget allowed_origins.

## Honey-pot Spam Filtering
Honeypot spam filter: hidden _hp field, checked first in the service. Filled → silent fake-201, stores nothing, logs server-side. Chose silent success over 400 so bots don't learn the honeypot exists (same 'reveal nothing' principle as 404-not-403).

## Geo-enrichment
Geo-enrichment via two independent providers (ipapi.co, ip-api.com) with 2s
AbortController timeouts, wrapped in enrichIp() which never throws — falls back
primary → secondary → null. Proved by breaking both providers: submission still
returned 201 and stored with null geo. Noticed a 429 ideally warrants backoff
rather than immediate fallthrough — left simple per "don't gold-plate."

Owner notification as a safe side effect: store first, notify second, wrapped in try/catch that logs and swallows. Submission returns 201 even when notify throws (proved with FAIL flag). Await + try/catch chosen over fire-and-forget; noted a job queue is the production path for slow side effects — out of scope here."

## Tests

Test suite with vitest + supertest, mocking geo, repository, and Supabase so tests are deterministic and need no live DB/network. Hit test-pollution: the rate-limit test leaked counter state into the geo test (429 instead of 201); fixed by resetting the limiter's store in beforeEach alongside vi.clearAllMocks(). Noted a fully resettable limiter is the cleaner long-term design.

## Phase 3 — Delivery, dashboard, and packaging
- Public cached config endpoint with a `toPublicConfig` projection (whitelists only
  safe fields; owner_id/allowed_origins never exposed). Cache-Control: max-age=60.
- Embeddable widget.js: reads its own ?id via document.currentScript, fetches config,
  renders the form, plants the honeypot, submits cross-origin. Wrapped in an IIFE to
  avoid polluting the host page.
- Customer-site test page on a second origin (localhost:5500) — watched the widget
  render and submit, with the OPTIONS preflight + POST visible in the Network tab.
  Bug: widget rendered but never showed — was building the DOM but not appending it
  to document.body. One-line fix.
- Dashboard endpoints (submissions + stats), tenant-scoped via a JOIN on owner_id.
- Deterministic test suite (see Tests entry).
- One-command docker compose: multi-stage Dockerfile (build stage compiles TS,
  run stage ships lean JS), auto-migrate on startup, healthcheck gate. Debugged:
  tsconfig moduleResolution:node was removed in newer TS; Supabase needs Node 22+
  (bumped base image); npm install network timeout (switched to npm ci with a
  longer fetch-timeout); db port needed publishing for the local seed script.
- Idempotent seed script that creates a demo widget and prints its embed snippet.