# Evidence

One concrete proof per Definition-of-Done requirement. Filled in as each is completed.
✅ = done and proven · 🚧 = not yet built.

## ✅ Persistence — data survives, schema as migrations
Schema lives in `migrations/001_init.sql` and is applied via `npm run migrate`
(idempotent — safe to re-run). Tables confirmed:

$ docker compose exec db psql -U postgres -d widgets -c "\dt"
public | submissions | table | postgres
public | widgets | table | postgres


## ✅ Authentication — real auth, not a stub
Supabase Auth issues a JWT on login; the `requireAuth` middleware verifies it before
any `/api` route. An unauthenticated request is rejected before reaching the handler:

$ curl -i -X POST http://localhost:3000/api/widgets
-H "Content-Type: application/json"
-d '{"type":"signup","title":"Should fail"}'

HTTP/1.1 401 Unauthorized
Content-Type: application/json; charset=utf-8
Content-Length: 33

{"error":"Access token required"}


## ✅ Widget management (owner CRUD)
An authenticated owner can create / list / read / update / delete their widgets.
Create, with a valid token — note `owner_id` is the verified Supabase user, not
client-supplied:

$ curl -i -X POST http://localhost:3000/api/widgets
-H "Content-Type: application/json"
-H "Authorization: Bearer $TOKEN1"
-d '{"type":"signup","title":"Newsletter Signup"}'

HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Content-Length: 273

{"id":"041f2793-dd34-4d14-ae46-0dce8dc0c213",
"owner_id":"6ad6a4b5-167b-4e17-970a-a8653388a07a",
"type":"signup","title":"Newsletter Signup","description":null,
"config":{},"allowed_origins":null,
"created_at":"2026-08-27T05:18:24.318Z",
"updated_at":"2026-08-27T05:18:24.318Z"}


## ✅ Tenant isolation — enforced in every query
`owner_id` is a `WHERE` clause in every owner query; cross-tenant access returns
404, not 403 (existence is not leaked). Proven with two Supabase users:

**Owner 1 lists their widgets → sees them:**

$ curl -i http://localhost:3000/api/widgets -H "Authorization: Bearer $TOKEN1"

HTTP/1.1 200 OK
Content-Length: 549

[{"id":"81d68621-9cac-413c-870b-658251d98027",
"owner_id":"6ad6a4b5-167b-4e17-970a-a8653388a07a",
"type":"signup","title":"Owner1 Newsletter","description":null,
"config":{},"allowed_origins":null,
"created_at":"2026-08-27T06:55:45.875Z","updated_at":"2026-08-27T06:55:45.875Z"},
{"id":"041f2793-dd34-4d14-ae46-0dce8dc0c213",
"owner_id":"6ad6a4b5-167b-4e17-970a-a8653388a07a",
"type":"signup","title":"Newsletter Signup","description":null,
"config":{},"allowed_origins":null,
"created_at":"2026-08-27T05:18:24.318Z","updated_at":"2026-08-27T05:18:24.318Z"}]


**Owner 2 lists → empty; cannot see owner 1's data:**

$ curl -i http://localhost:3000/api/widgets -H "Authorization: Bearer $TOKEN2"

HTTP/1.1 200 OK
Content-Length: 2

[]


**Owner 2 fetches owner 1's real widget id directly → 404 (the widget exists, but is invisible to owner 2):**

$ curl -i http://localhost:3000/api/widgets/81d68621-9cac-413c-870b-658251d98027
-H "Authorization: Bearer $TOKEN2"

HTTP/1.1 404 Not Found
Content-Type: application/json; charset=utf-8
Content-Length: 28

{"error":"Widget not found"}


## ✅ Validation at the boundary
Zod validates the request body before any business logic; invalid input returns 400
with details and never reaches the service or DB. (Auth runs first, so this request
carries a valid token to reach the validation layer.)

$ curl -i -X POST http://localhost:3000/api/widgets
-H "Content-Type: application/json"
-H "Authorization: Bearer $TOKEN1"
-d '{"type":"banana","title":"Nope"}'

HTTP/1.1 400 Bad Request
Content-Type: application/json; charset=utf-8

{"error":"Invalid widget","details":[{"code":"invalid_value",
"values":["signup","cta","popover"],"path":["type"],
"message":"Invalid option: expected one of "signup"|"cta"|"popover""}]}


## ✅ Public config delivery (cached, projection only)

no owner_id/allowed_origins in the public payload — projected via toPublicConfig

curl -i http://localhost:3000/widgets/81d68621-9cac-413c-870b-658251d98027/config
HTTP/1.1 200 OK
X-Powered-By: Express
Access-Control-Allow-Origin: *
Cache-Control: public, max-age=60
Content-Type: application/json; charset=utf-8
Content-Length: 120
ETag: W/"78-eBJAGiLG46IwB4YQpl3NbV2EafQ"
Date: Sun, 30 Aug 2026 11:40:39 GMT
Connection: keep-alive
Keep-Alive: timeout=5


{"id":"81d68621-9cac-413c-870b-658251d98027","type":"signup","title":"Owner1 Newsletter","description":null,"config":{}}% 

## ✅ Embeddable widget script (one-line snippet)
A single `<script src="/widget.js?id=...">` line renders a working form on a page
served from a different origin (localhost:5500), which submits cross-origin.

$ curl -i http://localhost:3000/widget.js
HTTP/1.1 200 OK
Content-Type: text/javascript; charset=utf-8

(the widget renders on customer-site/index.html and submits; browser Network tab
shows the OPTIONS preflight 204 then POST 201)


## ✅ Hardened submission path — CORS + preflight
A cross-origin JSON POST triggers a preflight. The server answers `OPTIONS` with
the CORS permission headers, and the real POST carries `Access-Control-Allow-Origin`
so the browser will deliver the response.

Preflight (what the browser sends automatically before the real request):

$ curl -i -X OPTIONS http://localhost:3000/submissions
-H "Origin: http://localhost:5500"
-H "Access-Control-Request-Method: POST"
-H "Access-Control-Request-Headers: Content-Type"

HTTP/1.1 204 No Content
Access-Control-Allow-Origin: http://localhost:5500
Vary: Origin
Access-Control-Allow-Methods: POST,OPTIONS
Access-Control-Allow-Headers: Content-Type
Access-Control-Max-Age: 86400


The real POST also carries the allow-origin header:

$ curl -i -X POST http://localhost:3000/submissions
-H "Origin: http://localhost:5500"
-H "Content-Type: application/json"
-d '{"widget_id":"81d68621-9cac-413c-870b-658251d98027","data":{"email":"visitor@example.com"}}'

HTTP/1.1 201 Created
Access-Control-Allow-Origin: http://localhost:5500
Vary: Origin
...


## ✅ Submission endpoint — validation, size limit, existence check, persistence
A well-formed submission for a real widget stores a row; malformed, oversized, or
wrong-widget requests are rejected with the right code and store nothing.

Valid submission → 201, and the row persists (note `country` is null — geo
enrichment runs later; the submission stores anyway, "degrade never fail"):

$ curl -i -X POST http://localhost:3000/submissions
-H "Content-Type: application/json"
-d '{"widget_id":"81d68621-9cac-413c-870b-658251d98027","data":{"email":"visitor@example.com","name":"Jane"}}'

HTTP/1.1 201 Created
{"id":"1","created_at":"2026-08-28T13:40:20.388Z"}


Non-existent widget → 404 (existence check, not an ownership check):

$ curl -i -X POST http://localhost:3000/submissions
-H "Content-Type: application/json"
-d '{"widget_id":"00000000-0000-0000-0000-000000000000","data":{"email":"x@y.com"}}'

HTTP/1.1 404 Not Found
{"error":"Widget not found"}


Malformed widget_id (not a UUID) → 400, rejected before any DB lookup:

$ curl -i -X POST http://localhost:3000/submissions
-H "Content-Type: application/json"
-d '{"widget_id":"not-a-uuid","data":{}}'

HTTP/1.1 400 Bad Request
{"error":"Invalid submission","details":[{"code":"invalid_format","format":"uuid","path":["widget_id"],"message":"Invalid UUID"}]}


Missing `data` field → 400:

$ curl -i -X POST http://localhost:3000/submissions
-H "Content-Type: application/json"
-d '{"widget_id":"81d68621-9cac-413c-870b-658251d98027"}'

HTTP/1.1 400 Bad Request
{"error":"Invalid submission","details":[{"code":"invalid_type","expected":"record","path":["data"],"message":"expected record, received undefined"}]}


Persisted row (data stored as sent, country null pending enrichment):

$ docker compose exec db psql -U postgres -d widgets -c
"select id, widget_id, data, country from submissions;"

id | widget_id | data | country
----+--------------------------------------+--------------------------------------------------+---------
1 | 81d68621-9cac-413c-870b-658251d98027 | {"name": "Jane", "email": "visitor@example.com"} |
(1 row)

## ✅ Rate limiting (429 under flood)

To test this rate limiting, we set the limit to 5 temporarily
done
--- request 1 ---
201
--- request 2 ---
201
--- request 3 ---
201
--- request 4 ---
201
--- request 5 ---
201
--- request 6 ---
429
--- request 7 ---
429
--- request 8 ---
429

 count 
-------
     6
(1 row)

HTTP/1.1 429 Too Many Requests
X-Powered-By: Express
Vary: Origin
RateLimit-Policy: 5;w=60
RateLimit: limit=5, remaining=0, reset=22

## ✅ Spam filtering (honeypot)
A submission with the honeypot field (`_hp`) filled is silently dropped: it returns
a 201 identical to a real one (revealing nothing to the bot), but stores nothing and
logs server-side. A normal submission stores; the honeypot one does not.

Normal submission → 201, stores:
$ curl -i -X POST http://localhost:3000/submissions
-H "Content-Type: application/json"
-d '{"widget_id":"81d68621-...","data":{"email":"human@example.com"}}'

HTTP/1.1 201 Created
{"id":"7","created_at":"2026-08-28T14:59:04.429Z"}


Bot submission (honeypot filled) → 201, looks identical, but id is null:

$ curl -i -X POST http://localhost:3000/submissions
-H "Content-Type: application/json"
-d '{"widget_id":"81d68621-...","data":{"email":"bot@example.com"},"_hp":"http://spam.com"}'

HTTP/1.1 201 Created
{"id":null,"created_at":"2026-08-28T14:59:16.453Z"}


Only the human was stored — the bot left no row — and the server logged the catch:

$ docker compose exec db psql -U postgres -d widgets -c
"select count(*), max(data->>'email') from submissions
where data->>'email' in ('human@example.com','bot@example.com');"

count | max
-------+-------------------
1 | human@example.com

server log:

[spam] honeypot triggered for widget 81d68621-9cac-413c-870b-658251d98027


## ✅ Geo-enrichment with graceful fallback (degrade, never fail)
Enrichment tries two independent providers, each with a 2s timeout, wrapped in
enrichIp() which never throws. On total failure it returns null geo — the submission
still succeeds. Proven by breaking BOTH providers:

$ curl -s -X POST http://localhost:3000/submissions
-H "Content-Type: application/json"
-d '{"widget_id":"81d68621-...","data":{"email":"geo-degraded@example.com"}}'
{"id":"13","created_at":"2026-08-28T16:06:56.124Z"} # still 201

server logs — both providers failed, two different failure modes:

[geo] primary failed for 8.8.8.8: Primary geo returned 429; trying secondary
[geo] secondary also failed for 8.8.8.8: fetch failed; storing without geo

the row stored anyway, with null geo:

select data->>'email', country, city ...
email | country | city
--------------------------+---------+------
geo-degraded@example.com | |

(Test scaffolding — forced IP 8.8.8.8 and broke both provider URLs — was reverted
after capturing this.)

## ✅ Safe side effects (non-critical failure doesn't break the main path)
After storing a submission, the owner notification fires as a safe side effect. When
it throws (FAIL flag), the submission still returns 201 and the row is stored — the
failure is logged and swallowed, never propagated.

$ curl -i -X POST http://localhost:3000/submissions
-H "Content-Type: application/json"
-d '{"widget_id":"81d68621-...","data":{"email":"notify-fail@example.com"}}'
HTTP/1.1 201 Created
{"id":"16","created_at":"2026-08-28T16:33:00.636Z"}

server log:
[notify] failed for submission 16: Email service unavailable

the lead stored anyway:
 email                   | country
-------------------------+---------
 notify-fail@example.com |



## ✅ Dashboard (submissions + stats per widget)
An owner sees submissions and aggregated stats for their widget; another tenant gets 404.

$ curl -i http://localhost:3000/api/widgets/81d68621-.../stats -H "Authorization: Bearer $TOKEN1"
HTTP/1.1 200 OK
{"total":17,"by_country":[{"country":"Unknown","count":16},{"country":"United States","count":1}]}

Owner 2 cannot see owner 1's widget's submissions:
$ curl -i http://localhost:3000/api/widgets/81d68621-.../submissions -H "Authorization: Bearer $TOKEN2"
HTTP/1.1 404 Not Found
{"error":"Widget not found"}

## ✅ Tests

✓ src/submissions/submissions.test.ts (7 tests) 207ms
   ✓ POST /submissions — validation (4)
     ✓ rejects a malformed widget_id with 400 74ms
     ✓ rejects a missing data field with 400 6ms
     ✓ stores a valid submission and returns 201 7ms
     ✓ returns 404 for a submission to a non-existent widget 4ms
   ✓ POST /submissions — spam honeypot (1)
     ✓ silently drops a submission with the honeypot filled (stores nothing) 6ms
   ✓ POST /submissions — rate limiting (1)
     ✓ returns 429 after the limit is exceeded 102ms
   ✓ POST /submissions — geo enrichment degrades (1)
     ✓ still stores the submission (201) when enrichment returns null geo 4ms

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  15:10:53
   Duration  1.56s (transform 243ms, setup 48ms, import 902ms, tests 207ms, environment 0ms)

## ✅ One-command run (docker compose up)
`docker compose up --build` boots the whole stack: Postgres goes healthy, then the
app connects, runs migrations automatically, and serves.

db-1  | database system is ready to accept connections
Container ...-db-1 Healthy
app-1 | Connected to Postgres
app-1 | Running migration: 001_init.sql
app-1 | Migrations applied
app-1 | Server running on http://localhost:3000

$ curl -i http://localhost:3000/health
HTTP/1.1 200 OK
{"status":"ok"}

