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
[YOUR SUMMARY — e.g. "Claude guided the build in a teacher-student format,
explaining each concept and line. I wrote/reviewed all code, debugged the issues
above myself with guidance, and can defend every decision. AI was most useful for
TypeScript tooling config and explaining new concepts (declaration merging, CORS);
least needed for the CRUD/SQL logic, which reused patterns I already knew."]

## CORS

Wired CORS on /submissions via the cors library; verified preflight (OPTIONS → 204 with Allow-Origin/Methods/Headers) and the real POST both carry the right headers. Currently permissive (origin: true) — to be tightened to per-widget allowed_origins.