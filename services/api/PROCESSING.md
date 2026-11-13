# Bounded source processing

Continuation: 2026-11-13. The user accepted the Healthchecks input package and
then selected its separately frozen P-08 discovery profile. The original
proposed JSON files remain unchanged; acceptance is recorded separately under
`openspec/changes/establish-versioned-continuity-core/`.

## Current boundary

Implemented and checked: bounded upstream acquisition, exact-byte verification,
operator registration, capture/discovery job admission, leased worker
publication, immutable source versions, unconfirmed automatic candidates,
attributed authored records, explicit manual candidates/successors and retained
snapshots for review. Capture and discovery publish in the same PostgreSQL
durability boundary as their versions, contexts, provenance and operation results.

This is not the full continuity cycle. Selected-revision comparison and incoming
revalidation, search, graph queries, cycle completion, export, release readiness
remain unfinished. The [frontend integration](FRONTEND.md) now uses real service
snapshots and has isolated browser/session verification. No Healthchecks upstream-test
pass or semantic research assessment is claimed.

## Accepted source and configuration

- Input proposal: `HC-UPSTREAM-2026-11-13-P1`.
- Input acceptance: `healthchecks-input-acceptance.json`.
- Manifest SHA-256: `57fe399e8f70706748f22307c272b9c612c703b1fac036477fb00d6c304e7b37`.
- Discovery profile: `HC-LEXICAL-2026-11-13-P1`, method `lexical-file-v1`.
- Profile acceptance: `discovery-profile-acceptance.json`.
- Profile SHA-256: `eeea88c56462a0f90c4f38ee1027bd214bc429cc64fecc0bb1b67bd29ca3fc75`.
- Inventory: ten paths, four selected commits, forty bindings, eighteen distinct
  regular-file blobs; 284,346 unique source bytes.

Raw upstream bytes are retained only in the ignored
`inputs/healthchecks/<manifest-sha256>/objects/` store. No clone, import following,
upstream dependency installation, template rendering or upstream execution is
performed. The acquisition tool allows only the accepted GitHub repository API,
rejects redirects, validates commit/tree/entry metadata and verifies Git blob
SHA-1 plus content SHA-256 before retaining strict UTF-8 bytes. It rejects
symlinks, junctions, path escape, changed accepted manifests and mismatched
retained artifacts. A failed acquisition cannot publish a successful receipt.

Run from the repository root:

```powershell
& services/api/.venv/Scripts/python.exe -m continuum.acquisition `
  --manifest openspec/changes/establish-versioned-continuity-core/healthchecks-input-manifest.proposed.json `
  --acceptance openspec/changes/establish-versioned-continuity-core/healthchecks-input-acceptance.json

& services/api/.venv/Scripts/python.exe -m continuum.discovery `
  --manifest openspec/changes/establish-versioned-continuity-core/healthchecks-input-manifest.proposed.json `
  --acceptance openspec/changes/establish-versioned-continuity-core/healthchecks-input-acceptance.json `
  --profile openspec/changes/establish-versioned-continuity-core/discovery-profile.proposed.json `
  --profile-acceptance openspec/changes/establish-versioned-continuity-core/discovery-profile-acceptance.json `
  --revision codeBase
```

The other accepted revision labels are `codeTarget`, `docsBase` and `docsTarget`.
Standalone discovery writes deterministic reports under ignored
`outputs/healthchecks-discovery/`; it does not publish application records or
human judgments. Existing differing reports are not overwritten. The original
acquisition verification record is retained separately; its earlier implementation
is archived locally under its recorded SHA-256 in
`outputs/healthchecks-processing/history/`.

## Service setup and operator registration

Follow [the service setup](README.md#local-setup) for the database, environment
and named accounts. `init-db` creates the additive initial processing tables and
retention triggers. It does not alter existing table columns, transform user
records or supply a data-migration procedure. The verification tests initialize
fresh isolated schemas; existing user data was not migrated.

After deliberately creating a repository identity and granting a named account
reviewer access, register the already acquired input and separately accepted
profile. Replace the argument placeholders with the returned IDs:

```powershell
& services/api/.venv/Scripts/python.exe -m continuum.admin register-input <repository-id> `
  openspec/changes/establish-versioned-continuity-core/healthchecks-input-manifest.proposed.json `
  openspec/changes/establish-versioned-continuity-core/healthchecks-input-acceptance.json

& services/api/.venv/Scripts/python.exe -m continuum.admin register-profile <repository-id> <inventory-id> `
  openspec/changes/establish-versioned-continuity-core/discovery-profile.proposed.json `
  openspec/changes/establish-versioned-continuity-core/discovery-profile-acceptance.json
```

Registration verifies retained input/profile identities. It never acquires new
source, and there is no public registration or acquisition endpoint. Tests use
isolated synthetic accounts against the accepted real source; no real product
account was provisioned by those tests.

## API workflow

All requests below use the authenticated cookie, allowed Origin, JSON content
type and session-bound CSRF token. POST queries enforce the same browser-origin
boundary. Current repository grants are checked on every query and command.

`POST /api/v1/queries` takes
`{schemaVersion: "0.1.0", requestId, repositoryId, query, input}`. Supported queries:

| Query | Input / result |
|---|---|
| `select_context` | Selection with repositoryId, full targetRevision, null baseRevision, inventoryId and configurationId. Returns an active repository view and retained snapshot. Only registered accepted revisions resolve. |
| `read_snapshot` | `{selection}`. Returns a new immutable snapshot with version-specific context membership, pending review/follow-up counts, coverage and limitations. |
| `open_review_view` | `{repositoryViewId, snapshotId, contextId}`. A current eligible snapshot yields an active bound view; retained/stale scope is historical. |
| `read_operation` | `{operationId}`. Returns queued/running/complete/partial/failed status, result snapshot, coverage and limitations. |
| `read_capture_results` | `{operationId, cursor: null or string, pageSize: 1..100}`. Exact version IDs and processing provenance; stable paged membership. |
| `read_discovery_results` | Same paging input. Immutable automatic run membership, exact evidence, method/configuration identities and unresolved path records. |
| `read_activity` | `{activityId}`. Retained method, responsible practitioner/system agent, inputs, server time and limitations. |

For the initial baseline, targetRevision is
`{objectAlgorithm: "sha1", commitId: "0f78e117eadb59a01dd51e09344479fa3eeb4187"}`.
`baseRevision` must currently be null: comparison admission is not implemented.

`POST /api/v1/commands` retains the existing envelope
`{schemaVersion, requestId, repositoryId, viewId, command, input}`. New commands:

| Command | Input / result |
|---|---|
| `capture_files` | `{targetRevision, inventoryId, configurationId}` through an active repository view. Returns a durable queued operation. |
| `discover_candidates` | Same input; capture must have published those exact versions first. Returns a queued operation, not discovered or confirmed relationships. |
| `capture_record` | `{kind: requirement/decision, title, content, sourceReference, sourceAbsenceReason}`. Source and absence reason are mutually exclusive; an absent source requires a reason. Returns an attributed immutable record version, without a Git commit or implicit relationship. |
| `revise_record` | `{artifactId, expectedRecordVersion, title, content, reason, sourceReference, sourceAbsenceReason}`. Returns a new version; earlier source/judgments are not retargeted. Stale versions return `record_conflict`. |
| `capture_candidate` | `{targetRevision, type: "documents", sourceArtifactId, targetArtifactId, sourceVersionId, targetVersionId, evidence, reason, predecessorContextId}`. Document-to-code only in this registry. Evidence names exact endpoint versions and valid line or `identity.path` locators. Returns an unconfirmed manual candidate. |

Record sourceReference can name an available artifact-version anchor or provide
external attributed metadata; external URIs are never fetched or treated as
independently verified. Record titles are limited to 200 characters and bodies
to 65,536 characters, also subject to the existing 256 KiB request-byte cap. NUL
characters are rejected. Authored requirements/decisions are represented as
records; the current discovery registry does not claim automatic semantic
analysis or new relation types for them.

An identical initial manual candidate reuses its retained identity. Different
evidence requires accountable correction. A rejected/retired claim requires an
explicit terminal predecessor and creates a separate unconfirmed successor;
it cannot be silently reset. Manual result membership cannot rewrite an
automatic discovery run or turn a miss into a successful automatic match.

After discovery completes, read a fresh snapshot, open its context-specific
review view, inspect exact versions/evidence and submit a separate judgment.
The earlier review, correction, reversal and follow-up commands remain available.
Supporting evidence lists now allow up to 1,024 unique references, accommodating
the accepted profile's maximum 512 two-ended evidence matches. No evidence is
silently dropped to fit the old 100-reference cap.

## Worker and transaction behavior

Normal API startup runs one embedded polling worker. A PostgreSQL session
advisory lock per schema enforces single-worker processing. The optional
`python -m continuum.admin worker-once` processes at most one durable eligible
operation and is useful for controlled recovery and tests.

Jobs retain their initiating actor, selection, generation, lease, deadline and
attempt count in PostgreSQL. Work reads immutable local input outside the
publication transaction. Before publication, the worker locks/rechecks account,
grant, repository and operation in a consistent order. It rejects revoked
reviewers, expired/superseded leases and changed selection state. Publication
commits versions, activities, candidates, memberships, operation results and the
retained result snapshot together. A storage failure rolls back publication.
No in-memory callback or queue is the durable job identity.

The frozen profile sets a 30-second lease, 10-second heartbeat, 60-second attempt
budget, 300-second operation lifetime and at most three claims. A crashed worker
can be reclaimed after lease expiry, with a newer fencing generation. An older
worker cannot publish over it. Permission loss is rechecked at claim, heartbeat
and publication. Reusing an admitted request identity returns its original
queued receipt; operation queries report the later processing result separately.

Snapshots retain artifact versions, projections, evidence availability metadata,
follow-up state and history high-water sequences. Later judgments/corrections
advance selected state and cannot rewrite retained snapshots. A stale review
view cannot authorize a new command. Identical committed receipt retries remain
available only after current authority checks. Refresh snapshot/view before a
new submission. Selection locks currently use the existing conservative
repository-row serialization boundary.

## Observed verification and limits

On 2026-11-13, the 104-test backend suite passed with dependency consistency
checks. A subsequently added TCP process test passed separately: authenticated
HTTP admission was picked up and completed by the API's embedded worker without
a manual worker call. Tests include real accepted Healthchecks bytes with
isolated synthetic service users, source-integrity failures, partial lexical
processing, forced PostgreSQL publication failure, revocation, lease fencing,
deadlines/attempt limits, manual/automatic separation and immutable record history.
The existing Starlette TestClient deprecation notice remains; it is not a failed
check or evidence of a browser/session UX pass.

The frozen standalone discovery reports reproduced byte-for-byte on all four
selected revisions. UP-07's predeclared automatic `failure`-token candidate was
observed at C0. Broad additional lexical matches were retained. These results
do not measure semantic precision, recall, productivity or effectiveness.

See the tracked `healthchecks-processing-verification.json` for source/profile
identities, output digests, tested source-file hashes and verification boundaries.
No selected-revision comparison, incoming revalidation, release demonstration or
participant administration was performed. Those remain separate tasks.


## Later continuity implementation

The dated results and exclusions above describe the earlier implementation
stage. See [CONTINUITY.md](CONTINUITY.md) for the later native Git comparison,
typed record links, incoming review, snapshot search/graph, completion and export.
[RELEASE.json](RELEASE.json) records the observed current development checks and
source identity. No deployment, live schema migration or practitioner results
are established by that continuation.
