# Local frontend integration

The normal application at `http://localhost:5173` uses the FastAPI service and
PostgreSQL. Synthetic state is available only at `?mode=demo`, in a separately
loaded application/provider. A missing session, failed request or empty repository
never selects demo data. Existing demo browser storage is left intact.

## Local access

On 2026-11-13 the user approved this URL and the named login `jc`, and supplied
the password through a secure prompt. The account is provisioned as a reviewer
for the local Healthchecks repository. Use that password in the login form.
There is no shared service password, public signup or browser persona switch.

The initialized local database contains four independent initial-review
selections, 40 captured file-version memberships and 76 unconfirmed relationship
contexts. These reuse the accepted 18 unique upstream blobs. No practitioner
judgments were installed. These counts describe bounded source processing,
not semantic accuracy, full-project coverage or an incoming-revision comparison.

The local development frontend proxies `/api` to `http://127.0.0.1:8787`.
Start the API from the repository root when restarting development:

```powershell
& services/api/Load-LocalEnv.ps1
$env:CONTINUUM_ORIGIN = 'http://localhost:5173'
$env:CONTINUUM_LOCAL_HTTP = '1'
& services/api/.venv/Scripts/python.exe -m uvicorn continuum.main:app_factory --factory --host 127.0.0.1 --port 8787
```

In a separate terminal:

```powershell
npm --prefix apps/web run dev
```

The explicit loopback HTTP profile uses development cookies. It does not establish
HTTPS deployment acceptance. The Vite proxy is development configuration; a
production same-origin proxy and deployment remain separate work.

`python -m continuum.local_setup --password-file <secure-delivery-file>` is the
one-time authorized local provisioning helper. It initializes additive tables,
creates `jc`, registers accepted inputs/profile and processes the four revisions.
It refuses to replace an existing account. Never pass a password as an argument,
commit a password file, or rerun schema setup as a migration strategy.

## Connected workflows

- Named account login, cookie session restoration and logout; CSRF stays in memory.
- Granted repository/input/profile discovery, exact revision selection, immutable
  snapshots, retained snapshot reads and current refresh.
- Relationship lists keyed by review context and assertion revision; exact source
  versions, evidence excerpts, processing provenance and retained review history.
- Confirmation/rejection/reconfirmation/retirement, independent content concerns
  and follow-up creation, verification-backed follow-up resolution and appended
  reversal of the effective judgment, subject to service transitions.
- Source/record browsing, authored requirement/decision capture with an explicit
  explanation for absent source references, and capture/discovery admission with
  inspectable processing status.
- Snapshot relationship graph, client-side path/method filtering, separate
  validity/follow-up counts and service coverage/limitation records.

Review drafts are scoped to actor, repository, target commit, context and assertion
revision. Record drafts are scoped to actor, repository and target commit. A write
envelope is saved before dispatch; an uncertain response retains its original
request ID and input for explicit retry. Login restoration never resubmits it.
Known command rejection preserves the draft without retrying the rejected request.
Unreadable browser draft storage is preserved and disables writing.

Historical snapshots and viewer grants disable review controls. The API independently
checks authority, snapshot membership, projection version and idempotency receipts.
An older browser response cannot replace a later selected context.

## Verification

Run from the repository root with PostgreSQL available:

```powershell
node --test apps/web/src/data/service.test.js apps/web/src/data/workflow.test.js
npm --prefix apps/web run lint
npm --prefix apps/web run build
# Install the test browser once after npm install:
npm --prefix apps/web exec -- playwright install chromium
& services/api/.venv/Scripts/python.exe -m pytest services/api/tests -q
```

The browser test starts temporary loopback Vite/API servers against a generated
PostgreSQL test schema. It uses accepted source with synthetic named accounts and
removes only that generated schema at teardown. Password input goes to the test
process over stdin. Tests cover session login, old-demo isolation, actual source
rows, exact evidence, draft reload, a competing-write conflict, a committed write
whose response is lost, identical retry with exactly one judgment, retained
history, historical reads, viewer restrictions, source browsing, logout and
offline failure. Desktop and mobile snapshots were inspected; the dashboard card retains its content height without viewport overflow. The summary is generated at
`outputs/frontend-integration/browser-result.json` (ignored).

## Continuity continuation, 2026-11-14

The original first-comparison limits above are superseded by the implemented
continuation in [CONTINUITY.md](CONTINUITY.md). The existing UI now connects
chained revision comparisons, manual typed candidates/successors, corrections
with optional new evidence anchors, authored-record revision, prior read-only
decision inspection, further history pages, server snapshot content/rationale
search, typed one-hop graph navigation, completion and queued JSON export.

The complete current verification and build identity are recorded in
[RELEASE.json](RELEASE.json). [GUIDED-TASKS.md](GUIDED-TASKS.md) separates the
automated accepted-input rehearsal from the still-unperformed practitioner study.
Existing local user data is preserved. Deployment, HTTPS acceptance and schema
migration remain separate authorized activities.
# First-load progress and initial rationale (2026-11-14)

`read_workspace.result.progress` is an additive lifecycle projection for its exact
snapshot ID/version. Steps contain `id`, `label`, `state`, `action` and `blockers`;
counts retain candidate/stale/confirmed/rejected/retired, reviewed and pending.
`baseline` identifies the retained baseline and its separate review counts.
`operations` exposes current processing for active snapshots and frozen processing
for historical ones; older snapshots without processing provenance report unknown
discovery. Captured choices never imply review completion. Git comparison does
not require all baseline candidates to be confirmed or even reviewed. Same-revision
comparison is permitted by the service and can produce an empty affected queue.
Refresh or check processing status after publication; state survives reload.

An initial candidate `record_judgment` confirm/reject may omit `reason` or send
null/blank (normalized to null). Nonblank text is preserved with existing bounds.
Eligibility comes from stored initial context, not a client claim. Incoming review,
reconfirmation, retirement, corrections, reversals and follow-up notes retain
their existing requirements. Evidence acknowledgment remains mandatory for
confirmation. Original uncertain-delivery envelopes are replayed unchanged.

History and new JSON exports use `reason: null, reasonStatus: "not_provided"` for
absence, or text plus `reasonStatus: "provided"`. Display null as “No reason
provided”; that label is not authored rationale and is not searched as such.
Legacy blank reasons are handled as absent on reads without rewriting rows.
This changes the development 0.1.0 reason contract additively; consumers must allow
null before rollout. Previously generated exports remain frozen.

Existing database rollout requires separately authorized application of
`migrations/optional-review-reason.sql` before deploying nullable writes. No live
migration is performed by this work or by ORM `create_all` on existing tables.
