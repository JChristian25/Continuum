# Continuum review service

FastAPI and PostgreSQL implement the first versioned-review service boundary.
The React application still uses synthetic browser data. It is not connected to
this API, and its personas do not authenticate service requests.

Implementation was requested on 2026-11-13, when the user selected FastAPI,
PostgreSQL, provisioned accounts and server-side sessions. The preserved design
draft and remaining work are in
[`implementation.md`](../../openspec/changes/establish-versioned-continuity-core/implementation.md)
and [`tasks.md`](../../openspec/changes/establish-versioned-continuity-core/tasks.md).

## Implemented boundary

- Provision named accounts through a local operator command. Passwords are
  prompted, Argon2id-hashed and never installed as shared defaults.
- Bootstrap/login/session/logout, server-held opaque sessions, idle/absolute
  expiry, CSRF, exact-origin checks, persistent login throttling and revocation.
- Explicit repository viewer/reviewer grants, rechecked before reads, writes and
  receipt disclosure. Unknown membership fails closed.
- Retained artifact versions, assertions, assertion revisions, review events and
  receipts. PostgreSQL triggers reject updates/deletes to these retained rows.
- Exact-version source and line-evidence reads with SHA-256 verification.
- Version-specific confirmation, rejection, reconfirmation and retirement.
- Correction with a retained predecessor and unconfirmed successor; a changed
  stable endpoint creates a replacement assertion.
- Latest-effective judgment reversal, with independent follow-up open/resolve.
- History pagination with a retained high-water sequence and reversal
  annotations evaluated at that sequence.
- Atomic event/projection/follow-up/receipt commit. Identical retries return the
  original committed response before checking the current projection; changed
  input under the same identity conflicts.

The initial API uses the SCHEMA-01 subset described below. It does not implement
SCHEMA-02 selection/snapshot/search/graph/export or source-processing commands.
Unsupported operations have no success placeholder.

## Local setup

Run commands from the repository root. Python 3.14.6 and PostgreSQL 17 were used
for the recorded verification. PostgreSQL runs in a Docker container bound only
to `127.0.0.1:55432`; its image digest is pinned in `compose.yaml`.

```powershell
python -m venv services/api/.venv
& services/api/.venv/Scripts/python.exe -m pip install -r services/api/requirements.lock
& services/api/.venv/Scripts/python.exe -m pip install -e 'services/api[test]'
```

For a fresh checkout, create `services/api/.env` from `.env.example`. Choose a
new random database password and use it in both `POSTGRES_PASSWORD` and the
database URL. The generated local `.env` and virtual environment are ignored by
Git. Never commit them or copy the database password into a product account.

```powershell
& services/api/Load-LocalEnv.ps1
docker compose --project-directory services/api up -d --wait
& services/api/.venv/Scripts/python.exe -m continuum.admin init-db
& services/api/.venv/Scripts/python.exe -m uvicorn continuum.main:app_factory --factory --host 127.0.0.1 --port 8000
```

The checked-in environment example explicitly selects a local HTTP profile.
It uses `continuum_dev_session` / `continuum_dev_pre` cookies and requires a
loopback origin. Normal operation requires an HTTPS origin and Secure,
HttpOnly, host-only `__Host-continuum_session` / `__Host-continuum_pre` cookies.
Do not count a loopback HTTP run as secure browser deployment evidence.

`init-db` creates the initial schema and retention triggers without removing
records. It is not an upgrade migration mechanism. There is no implicit database
creation on API import/startup, and no auto-provisioned product account.
`create-repository` registers identity only; it does not acquire source files.

Operator examples, to run deliberately with the chosen account/repository:

```powershell
& services/api/.venv/Scripts/python.exe -m continuum.admin create-account reviewer 'Named Reviewer'
& services/api/.venv/Scripts/python.exe -m continuum.admin create-repository 'Selected project'
# Use the repository ID returned by create-repository:
& services/api/.venv/Scripts/python.exe -m continuum.admin grant reviewer <repository-id> reviewer
& services/api/.venv/Scripts/python.exe -m continuum.admin grant reviewer <repository-id> none
& services/api/.venv/Scripts/python.exe -m continuum.admin reset-password reviewer
& services/api/.venv/Scripts/python.exe -m continuum.admin disable-account reviewer
```

These examples are instructions, not a record that real accounts were created.
Keep operator access separate from product roles. Neither a reviewer nor a
viewer has a provisioning, source-acquisition or role-changing HTTP endpoint.
Credential delivery and deployment remain outside this slice.

Stop the local database with `docker compose --project-directory services/api
stop`. This preserves the local named volume. Do not remove its volume to reset
real data.

## API subset

Generated OpenAPI is available at `/openapi.json`, with interactive reference at
`/docs` while the API runs. All browser POSTs require the configured `Origin`,
JSON content type and session-bound `X-CSRF-Token`; no credentialed CORS is
enabled. GET bootstrap rejects an explicitly foreign origin/fetch-site.

| Route | Behavior |
|---|---|
| `GET /api/v1/health` | Check database connectivity; not a full-release readiness claim. |
| `GET /api/v1/auth/bootstrap` | Issue a ten-minute anonymous pre-session and CSRF token. |
| `POST /api/v1/auth/login` | Accept SCHEMA-01's versioned named-credential body and bootstrap CSRF. Replace the pre-session on success. |
| `GET /api/v1/auth/session` | Return authenticated actor, expiry and CSRF token. |
| `POST /api/v1/auth/logout` | Revoke session and clear cookie. An expired/absent session requires a fresh valid bootstrap/CSRF flow to clear its cookie. |
| `POST /api/v1/commands` | Execute `record_judgment`, `correct_assertion`, `reverse_judgment`, `open_follow_up`, or `resolve_follow_up`. |
| `GET /api/v1/repositories/{repositoryId}/contexts/{contextId}?viewId=...` | Return bound view, projection, assertion revision and evidence references. |
| `GET /api/v1/repositories/{repositoryId}/versions/{versionId}` | Retrieve retained exact source bytes as UTF-8 text and digest. |
| `GET /api/v1/repositories/{repositoryId}/evidence/{evidenceId}` | Resolve recorded line anchor against its exact source. Mark unresolved anchors explicitly. |
| `GET /api/v1/repositories/{repositoryId}/contexts/{contextId}/history?viewId=...&pageSize=20&cursor=...` | Retrieve a stable retained history sequence, rechecking permission each time. |

Command envelope and input fields follow SCHEMA-01 in the preserved design.
Unknown fields, including client actor/role fields, are rejected. Reasons are
retained exactly; they must contain non-whitespace text. Evidence IDs are unique.
Confirmation/reconfirmation must enumerate the revision's required evidence.
Missing incoming endpoint versions cannot be confirmed, but reasoned retirement
can preserve the absence and earlier references.

Errors use `{schemaVersion, requestId, error: {code, message, details}}`. Failed
persistence returns 503 `unavailable`, without a saved acknowledgment. Retry
uncertain delivery using the same command/request identity and exact input.
409 `stale_projection` includes `currentProjectionVersion` after authorization;
409 `idempotency_conflict` identifies changed input under an existing receipt.
Historical mutations and invalid transitions return 422. Validation responses
never echo submitted bodies or passwords.

## Transactions and operating defaults

The service locks account, session, grant and repository in that order. All
implemented domain writers take the repository row lock before receipt lookup,
context validation and event publication. This serializes writes within one
repository in the first slice. It is a conservative substitute for selection
locks while selection/snapshot processing is unimplemented, not an assertion
that the final processing architecture is finished. Revocation/reset commands
lock the account before grants/sessions, so authority changes are ordered against
waiting requests. No application mutex is the persistence boundary.

Each successful write atomically retains events, current projections, follow-up,
repository snapshot counter and its original response receipt. Database
constraints enforce receipt scope and event sequence uniqueness. Errors roll
back the transaction. Security lifecycle audit is a separate append-only stream
and does not advance domain review state. It stores action, outcome, time and
known subject ID; it stores no passwords, tokens, CSRF secrets or request bodies.
IP audit retention and operator identity attribution are future operating-policy
work; no client IP/header is accepted as trusted operator authority.

Limits: body 256 KiB; reason/note 8,000 characters; evidence list 100 entries;
history page 1–100; database lock wait 5 seconds. Sessions expire after 30 minutes
idle or 8 hours absolute; login bootstrap lasts 10 minutes. Argon2id uses 19 MiB,
2 iterations and parallelism 1. Provisioned passwords require 12–128 characters.
Five failed attempts per normalized login in 15 minutes trigger a persistent
throttle. This is an initial account throttle, not a comprehensive perimeter
abuse-control deployment. Source-size, inventory, job and export limits remain
prerequisites for their unimplemented command families.

## Verification

```powershell
& services/api/.venv/Scripts/python.exe -m pytest services/api/tests -q
& services/api/.venv/Scripts/python.exe -m pip check
node --test apps/web/src/data/workflow.test.js
npm --prefix apps/web run build
npm --prefix apps/web run lint
```

Tests require PostgreSQL. Set `CONTINUUM_TEST_DATABASE_URL` to an isolated test
database, or let the tests use the local ignored `.env`. Every fixture creates a
random `continuum_test_<uuid>` schema and removes only that schema after use.
Tests do not delete/recreate the configured database, reset the main application
schema, inspect another checkout or acquire Healthchecks. Data and user accounts
in these schemas are explicitly synthetic.

Observed on 2026-11-13: 43 PostgreSQL tests passed, including two concurrent
reviewers, identical retry races, forced receipt-write failure with complete
rollback, revocation winning an authority-lock barrier, correction successors,
stable history during appends, missing evidence, independent follow-up and a
real TCP API-process restart retaining session/history/receipt. Operator provisioning,
grant changes, credential reset and account disable are also exercised. OpenAPI generation,
initial schema setup and operator CLI help were checked. The test dependencies
emit one Starlette notice that its HTTPX TestClient adapter is deprecated; this
does not affect the passing result, and a future dependency update should adopt
its supported successor deliberately.

The existing five frontend workflow tests and production build pass. Frontend
lint exits successfully with an existing `set-state-in-effect` warning; the build
also reports its existing large-chunk warning. No frontend source was changed.

Not verified: browser HTTPS/session UX, frontend/service adapter, real source
capture, automatic discovery, real selected-commit comparison, background job
leases, snapshots/search/graph/export/completion, Healthchecks outcomes,
deployment or research effectiveness. Current tests do not establish those
claims. No gstack review or completed release is claimed.

Implementation references: [FastAPI testing](https://fastapi.tiangolo.com/tutorial/testing/),
[SQLAlchemy transactions](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html),
and [Psycopg installation](https://www.psycopg.org/psycopg3/docs/basic/install.html).
