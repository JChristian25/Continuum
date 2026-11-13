# Design

Implementation status (2026-11-13): the user subsequently authorized the build and selected FastAPI/PostgreSQL with provisioned accounts and server-side sessions. See [implementation.md](implementation.md) for the executable first boundary, operating defaults and remaining gates, and [tasks.md](tasks.md) for observed progress. The earlier dated planning decisions and pending status below are retained as history; they do not establish that later implementation or integration is complete.

## Context

See proposal.md for the intent and the four capability deltas for proposed behavior. This is a draft technical design during specification work. It is not implementation-ready: the blocking decisions below must be resolved before a bounded implementation task is authorized.

The only implementation baseline is this project's React/Vite frontend. `apps/web/src/data/workflow.js` stores judgments on fixture artifacts; `apps/web/src/context/ContinuumContext.jsx` manages browser state and client personas. `apps/web/src/data/state.js` suppresses storage errors. `apps/web/src/components/Inspector.jsx` combines baseline and incoming history, and `apps/web/src/components/ReviewSummary.jsx` uses fixed sample repository/revision labels. Those are observed limitations, not existing service contracts.

## Goals / Non-Goals

Goals: define versioned domain boundaries, explicit transaction outcomes and evidence/review history that a future backend can expose to the existing UI. Keep domain state independent from panels, selected modules and draft text.

Non-goals: implement an adapter or backend now; select a stack by implication; migrate browser data into a production database; build extensions; or change the current frontend-demo specification through this proposal. UI/service integration must be scoped and reviewed separately.

## Decisions

### Separate identity, versions and review projections

Proposed domain records are Artifact, ArtifactVersion, Assertion, AssertionRevision, Evidence, ReviewContext, ReviewEvent, FollowUp, Comparison and CycleCompletion. Their field candidates and command behavior are recorded in the background `specs/continuity-contract.md`; final transport schemas remain a specification prerequisite.

Artifact identity is stable within its repository. A file version pins repository, commit, path and blob; authored records pin record ID and immutable version. An assertion identifies a typed claim between stable artifacts; its immutable revision pins endpoint versions and evidence. This avoids using a display label or artifact ID as the identity of every judgment involving that artifact.

Alternative: serialize the whole browser workspace as the service model. It would couple domain history to UI flags and retain the current one-review-per-artifact assumption. The proposed records isolate that state without requiring a particular database.

### Derive active state from retained events

Judgments name exact assertion revisions and append events. Earlier confirmations remain tied to their original versions. A changed confirmed context begins stale; a changed unconfirmed one begins candidate. Correction keeps a predecessor; reversal appends an accountable event instead of deleting history. Follow-up events remain independent.

Alternative: repeatedly overwrite the current artifact's review fields. That cannot supply the exact-version historical interpretation required by the new deltas. The existing demo undo is retained as current demo behavior until a later integration change explicitly replaces it.

### Make trusted writes atomic

Proposed write boundary: authenticate, check repository permission, validate context/evidence and transition, then atomically commit event, projection and retry receipt. Client-supplied names/roles are not authority. Unknown actors fail closed for every command, including authored intent and follow-up.

A repeated request identity with identical input returns its committed result before applying the original expected-version check. Reused identity with different content or a new command against stale state returns conflict. A failed transaction cannot advance progress. A timeout leaves delivery uncertain; retry the same request identity. Final authentication and storage choices are blocking decisions, not assumptions about installed infrastructure.

### Keep revision processing bounded and inspectable

Proposed processing resolves selected commits and reads immutable source objects. A declared support profile separates capture, extraction, evidence and change handling. Direct impact traverses one registered documents relationship from either changed endpoint, retaining the directed meaning and reason. Unsupported identity matching remains unresolved.

The lexical rule in background proposal P-08 is an option to review, not a chosen or measured algorithm. If selected, record its exact tokenization, stop list, inventory and configuration, prohibit future-revision leakage and retain separate automatic/manual results. Do not tune the rule against expected demonstration outputs without recording a new configuration.

### Preserve the current UI through a later data boundary

A later integration proposal can place demo and service adapters behind the existing actions/selectors. Queue items need assertion/context identity; history needs a lossless normalized shape; summary and exports need selected-context identity. Keep CSS, component layout and navigation. The interface must identify synthetic versus real evidence.

This is a proposed integration seam, not part of the current runtime change. PRODUCT.md and DESIGN.md remain the UI reference. Current baseline requirements stay in frontend-demo until deliberately changed.

## Risks / Trade-offs

- More explicit version records increase storage and query work. Bound inventory and retrieve evidence/history on demand; select actual limits before integration.
- Weak lexical matches can produce many candidates. Expose methods and limitations, cap processing explicitly and never treat a score as a verified probability.
- Deleted or moved sources can break anchors. Preserve original locators and earlier objects; report unresolved continuity instead of inventing a replacement.
- Introducing a service can lose drafts or misattach delayed responses after navigation. Key drafts and results by context/assertion revision and test uncertain delivery and conflicts.
- A structurally valid OpenSpec proposal can still contain unresolved design choices. Keep the blockers visible and all implementation tasks unchecked.

## Implementation prerequisites

These are blocking decisions for implementation, not deferrable details:

| ID | Decision needed | Completion evidence |
|---|---|---|
| A-STACK | Backend language/framework and storage with required atomicity | STACK-01 proposes FastAPI/PostgreSQL with alternatives and transaction gates; acceptance and dependency compatibility remain pending |
| A-AUTH | Trusted identity, session and repository permission mechanism | AUTH-01 proposes provisioned accounts, opaque sessions and repository roles; acceptance and live negative-case verification remain pending |
| A-SCHEMA | Final request/response, projection and error schemas | SCHEMA-01/02 below draft the core command families; acceptance and resolution of referenced policy blockers remain pending. Generated API validation is future implementation evidence. |
| A-LIMITS | File, byte, candidate, page and operation-duration limits | Named values/units, partial/failure behavior and boundary tests |
| A-DISCOVERY | Concrete first discovery method and support depth | Versioned method/configuration and independent expected outcomes |
| A-INPUT | Authorized Healthchecks acquisition, exact commits and eligible Python/Markdown/plain-text inventory | Reproducible input manifest without consulting other local folders |

The initial OpenSpec setup recorded these prerequisites without selecting technologies. The dated drafts below now propose concrete choices while keeping acceptance and verification outstanding. No implementation readiness is implied by a status command finding all artifact files.

## Migration Plan

Current change: add planning files only. Keep existing specs/ as background; do not synchronize proposed capability deltas into main specs or archive them as implemented.

Future implementation: resolve prerequisites, approve a bounded task and its file scope, verify it, then explicitly plan frontend integration. No existing user repository or data is reset by that work. Any future migration needs its own reviewed compatibility and backout procedure; none is performed here.

## Traceability

| Capability | Parent requirement IDs | Planned acceptance references |
|---|---|---|
| artifact-context | C-01, C-02, C-03 | HC-01/02, T-03/10/15/16/18 |
| relationship-review | C-03, C-04, C-05, C-07, C-08, C-10 | HC-02D/03/05/06/07, T-01 through T-11 |
| revision-revalidation | C-06, C-07, C-09, C-10 | HC-04/08, T-12 through T-18, T-21/22 |
| knowledge-access | C-03, C-08 | T-19/20 and guided tasks G-01/G-04 |

The parent register carries thesis anchors and core/extension status. Humanizer guides prose, while OpenSpec supplies artifact structure. Neither structural validation nor editorial review proves functional behavior or replaces the user's approval.

## Latest-manuscript alignment

MS-2026-11-09 is the source pinned in specs/manuscript-source.md. The user explicitly included plain text in the proposed core on 2026-11-09. Support must therefore be specified for Markdown and plain-text documents, alongside the selected Python language (§1.5, PDF p. 22); this does not add other programming languages or document formats.

The proposed typed graph, provenance, search and graph inspection reflect §1.5 (pp. 21-22), §1.7 (pp. 25-27), §3.7.1/Table 4 (pp. 76-77) and §3.7.5 (pp. 83-85). RDF exchange remains optional (Table 4, p. 77). Their proposed UI access uses the current design as its reference; the current frontend-demo spec still describes only observed synthetic behavior.

Table 5 explicitly calls the stack a shortlist subject to verification (§3.7.3, pp. 79-80). The Next.js/TypeScript, FastAPI, Redis/RQ, Tree-sitter, Docling and Neo4j entries are proposed technologies, not evidence of installation or authorization to replace this frontend. A-STACK and the other implementation prerequisites stay open.

Exact event storage, request idempotency, latest-judgment reversal, successor IDs, one-hop propagation and lexical token rules are engineering choices. The manuscript requires the accountable continuity behavior, not those exact mechanisms (§3.7.2 p. 78; §3.7.5 pp. 83-85). Keep their proposed status visible.

Use specs/manuscript-reconciliation.md for requirement-to-source mappings and specs/demonstration-plan.md for the four manuscript-derived guided tasks and readiness evidence. No implementation or participant administration occurs during this reconciliation.

## SCHEMA-01: review contract draft

Version: 0.1.0, dated 2026-11-11. Status: proposed, unimplemented and awaiting design acceptance. This section refines A-SCHEMA using the background continuity contract; it is the active proposal for these commands. It does not select a framework, storage engine, identity provider, discovery configuration or transport URL. All examples are synthetic contract fixtures, not Healthchecks evidence. No service or functional test was run to produce them.

### Types and identity

JSON names below are case-sensitive. IDs are nonempty opaque strings; counts and projection versions are nonnegative integers, never numeric strings. Reasons and verification notes are strings containing at least one non-whitespace character. Times are server-issued UTC RFC 3339 strings. Nullable fields are explicitly shown; required fields cannot be omitted. Unknown fields, including client-supplied actor/role/time fields, are invalid input. The backend schema should eventually generate transport validation and documentation from this contract.

| Type | Fields and rules |
|---|---|
| CommitRef | `objectAlgorithm: "sha1" or "sha256"`, `commitId: string`; full hexadecimal object ID, respectively 40 or 64 characters. Branch names and abbreviated hashes are not retained identity. |
| FileVersion | `id, artifactId, repositoryId: string`, `commit: CommitRef`, `path: string`, `blobId: string`, `contentDigest: {algorithm: "sha256", value: string}`. Path is repository-relative; blob belongs to that path at that commit. Digest is 64 hexadecimal characters. |
| RecordVersion | `id, artifactId, repositoryId, recordId: string`, `recordVersion: integer >= 1`, `contentDigest` as above. Used for authored requirements/decisions, without invented Git identity. |
| EndpointRef | `artifactId: string`, `versionId: string or null`, `availability: available/missing/unsupported/unresolved`, `reason: string or null`, `priorVersionId: string or null`. Null version is allowed only for missing/unresolved incoming endpoints, with a reason and retained prior reference when known. It cannot be confirmed. |
| EvidenceRef | `id, artifactVersionId: string`, `locator: {kind: "lines", startLine: integer >= 1, endLine: integer >= startLine}` or `{kind: "field", fieldPath: string}`, `availability` as above, `reason: string or null`, `methodId: string`, `excerptDigest: digest or null`. Available evidence requires a valid locator and digest; other states require a reason. |
| AssertionRevision | `id, assertionId, repositoryId, type: string`, `source, target: EndpointRef`, `evidenceIds: array of unique strings`, `methodId: string`, `limitations: array of strings`, `supersedesRevisionId: string or null`. Immutable; stable endpoint identity/type belong to its assertion. |
| ReviewProjection | `contextId, repositoryId, assertionRevisionId: string`, `kind: initial/comparison`, `baseRevision: CommitRef or null`, `targetRevision: CommitRef`, `comparisonId: string or null`, `initialValidity: candidate/stale`, `validity: candidate/stale/confirmed/rejected/retired`, `resolution: open/resolved/superseded`, `projectionVersion: integer`, `effectiveJudgmentEventId: string or null`, `successorContextId: string or null`. Initial contexts have null base/comparison; comparison contexts have both. |
| ReviewEvent | `id, repositoryId, contextId, assertionRevisionId, actorId: string`, `recordedAt: UTC timestamp`, `sequence: integer >= 1`, `type: judgment/correction/reversal/follow_up_opened/follow_up_resolved`, `reason: string`, `payload: object`. Payload is the command-specific committed data and immutable referenced IDs, never arbitrary executable content. |
| FollowUp | `id, contextId, assertionRevisionId, openedByEventId: string`, `kind: code_update/documentation_update`, `status: open/resolved`, `resolutionEventId: string or null`. Notes and resolution do not change relationship validity. |

All referenced versions, evidence, assertions, contexts and view handles must belong to the same accessible repository. Available sources have null reason; unavailable sources carry a reason. The typed relation registry and support profile determine compatible endpoint kinds; this draft exercises `documents` from document to code without authorizing automatic extraction of other types. Artifact/evidence records are returned by their IDs so history can inspect exact versions instead of embedding mutable current text.

An incoming deleted endpoint is an explicit EndpointRef with `versionId: null`, not a fabricated file version or a copy of the old blob. Its prior version remains inspectable. Evidence availability and processing coverage are separate: a readable anchor does not establish complete inventory processing. Confirm/reconfirm requires both exact endpoint versions and at least one available supporting evidence item, with no required evidence unresolved. Rejection or retirement may record a reason about missing source without claiming it was inspected as readable.

### View authority and command envelope

The server issues an opaque `viewId` identifying repository, context, assertion revision and mode (`active` or `historical`). The read response exposes those bindings. This is a server-resolved reference, not a permission token: every command still authenticates and checks repository access. A client cannot change mode by sending `kind: "initial"` or changing its visible pane. Active initial review at B0 is allowed before B0 is used as comparison history. Opening a comparison exposes its B0 view as historical and its B1 view as active. A retained initial context is not implicitly rewritten; an explicit return to an independently eligible active view is different from writing through the comparison's historical handle.

Every write takes `{schemaVersion: "0.1.0", requestId: string, repositoryId: string, viewId: string, command: string, input: object}`. `requestId` is the idempotency identity, scoped by authenticated actor, repository and command. Review writes include `contextId`, `assertionRevisionId` and `expectedProjectionVersion` inside input. Their IDs must match the view's server-side bindings. Comparison submission uses an active repository view with null context/revision bindings, rather than borrowing a historical review handle.

Authorization is checked before any receipt is disclosed. An identical committed retry returns its original immutable result before live-state checks, even if the context is now superseded; it performs no new write. If a request identity was already committed with different input (including a different viewId), return `idempotency_conflict`. Equality uses parsed typed JSON with object key order ignored, array order preserved, and all field values compared exactly; no whitespace trimming of stored reasons. A new command then validates active mode, bindings, projection version and transition. The event(s), projection(s), follow-up changes and receipt commit atomically. A server-issued historical view rejects new domain mutations regardless of a valid reviewer role; SCHEMA-02 separately permits retained historical export without changing reviewed data.

Success is `{schemaVersion, requestId, result: object}`. Review results contain `eventIds: string[]`, `projection: ReviewProjection`, `followUps: FollowUp[]` for the resulting context; correction additionally contains `successorProjection`. Retry returns the originally committed result, not an apparently updated projection. The client refreshes separately and keeps drafts keyed by context/revision.

### Transition rules

These proposed guards apply only to new commands in eligible active contexts. All review mutations advance the affected context's projection version, including follow-up changes. Superseded contexts accept history reads only. A relation's support is confirmed only when validity is confirmed and resolution is resolved in the selected context; earlier confirmations never support different incoming versions.

| Starting state | Command | Result and guard |
|---|---|---|
| candidate/open | `record_judgment`, decision `confirm` or `reject` | confirmed/resolved or rejected/resolved. Confirmation requires exact readable evidence; rejection still needs authority and reason. |
| stale/open | `record_judgment`, decision `reconfirm` or `retire` | confirmed/resolved or retired/resolved. Reconfirm records the incoming revision and evidence; retirement ends support only for this context. |
| confirmed/resolved | `record_judgment`, decision `retire` | retired/resolved; retains the confirmation as a prior effective judgment for reversal. |
| candidate/open or stale/open | `correct_assertion` | Atomically mark predecessor resolution superseded, preserve its validity/history, and create candidate/open successor with projection version 0. Same type/stable endpoints: new assertion revision. Different type/stable endpoint: replacement assertion with predecessor assertion reference. |
| confirmed/rejected/retired with resolved resolution | `reverse_judgment` | Only the latest non-reversed judgment in that context is eligible. Append reversal; derive projection from the preceding non-reversed judgment, or initialValidity/open when none exists. |
| active, not superseded | `open_follow_up` or `resolve_follow_up` | Append independent event(s), preserve validity/resolution; resolution requires an existing open follow-up and verification note. |

`confirm` on stale and `reconfirm` on candidate are invalid transitions. Rejected/retired contexts cannot receive another judgment or correction until an allowed reversal restores an eligible state; reversal does not create a new claim. A new claim after a terminal outcome instead needs explicit successor capture under SCHEMA-02. Corrections cannot be reversed by `reverse_judgment`: their targets are not judgment events. A mistaken correction requires a further accountable successor, never restoration by deletion. A correction successor requires its own confirmation even if its predecessor was once confirmed.

Follow-up notes are never candidates for reversal. A note added after a judgment increments the projection version but does not become the latest judgment. Reversal retains open and resolved notes, their original decision references and verification notes; the response/history exposes the referenced judgment as reversed so a reader can reassess the note. No automatic reopening or completion of follow-up occurs. Current cycle completion is recalculated when pending work changes; stored completion snapshots remain intact.

### Command inputs

All fields below are required unless explicitly nullable. The shared review input is `contextId, assertionRevisionId, expectedProjectionVersion`.

| Command | Additional input | Result |
|---|---|---|
| `record_judgment` | `decision: confirm/reject/reconfirm/retire`, `reason: string`, `reviewedEvidenceIds: unique string[]`, `contentConcern: string or null`, `followUpDisposition: {kind: "none"}` or `{kind: "open", workKind: code_update/documentation_update, note: string}` | Judgment event and projection; optional concern retained on event, optional independently identified follow-up. Reviewed evidence IDs must belong to the revision. Confirmation/reconfirmation enumerates all required supporting evidence. |
| `correct_assertion` | `reason`, `replacement: {type, sourceArtifactId, targetArtifactId, sourceVersionId, targetVersionId: string, evidenceIds: unique nonempty string[]}` | Correction event, predecessor and successor projections, immutable successor revision and optional replacement assertion. Versions/evidence must resolve and match endpoints; never silently combine old and new fields. |
| `reverse_judgment` | `eventId, reason: string` | Reversal event naming the exact judgment and recomputed projection. Wrong context/revision is invalid input; an older or already reversed judgment conflicts. |
| `open_follow_up` | `workKind: code_update/documentation_update`, `note: string`, `relatedJudgmentEventId: string or null` | Open follow-up and event. Non-null related judgment belongs to this context/revision and remains inspectable even after reversal. |
| `resolve_follow_up` | `followUpId, verificationNote: string` | Resolution event and updated follow-up. No implicit validity change; already resolved work is an invalid transition. |
| `compare_revisions` | Repository view only; `baseRevision, targetRevision: CommitRef`, `inventoryId, configurationId: string` | Accepted comparison identity and status. Does not imply processing completed. |

Comparison status query result: `{comparisonId, repositoryId, baseRevision, targetRevision, inventoryId, configurationId, status: queued/running/complete/partial/failed, outcomes: array, limitations: string[]}`. Each outcome is `{assertionId: string or null, contextId: string or null, kind: unchanged/review_required/unresolved/unsupported, reason: string}`. An incomplete comparison cannot claim unchanged scope for omitted inputs. Retry reuses the comparison receipt; repeated processing of the same comparison cannot duplicate contexts. A changed confirmed predecessor yields stale/open; a changed predecessor without effective confirmation yields candidate/open. Retired assertions are not automatically revived by comparison; new capture needs an explicit successor.

### Synthetic request/response examples

The examples use opaque IDs for previously resolved fixture records. Fixture B0 is `{ "objectAlgorithm": "sha1", "commitId": "0000000000000000000000000000000000000000" }`; B1 ends in `1` instead. These fixture hashes do not identify acquired Git objects. `view-init` binds active initial context `ctx-0`, revision `ar-0`, repository `repo-example` at B0. Its initial projection is candidate/open, version 0.

```json
{
  "schemaVersion": "0.1.0",
  "requestId": "req-confirm-0",
  "repositoryId": "repo-example",
  "viewId": "view-init",
  "command": "record_judgment",
  "input": {
    "contextId": "ctx-0",
    "assertionRevisionId": "ar-0",
    "expectedProjectionVersion": 0,
    "decision": "confirm",
    "reason": "The cited document describes the selected code version.",
    "reviewedEvidenceIds": ["ev-0"],
    "contentConcern": "The terminology needs clarification.",
    "followUpDisposition": {"kind": "open", "workKind": "documentation_update", "note": "Clarify the terminology."}
  }
}
```

```json
{
  "schemaVersion": "0.1.0",
  "requestId": "req-confirm-0",
  "result": {
    "eventIds": ["event-confirm-0", "event-follow-0"],
    "projection": {
      "contextId": "ctx-0", "repositoryId": "repo-example", "assertionRevisionId": "ar-0",
      "kind": "initial", "baseRevision": null,
      "targetRevision": {"objectAlgorithm": "sha1", "commitId": "0000000000000000000000000000000000000000"},
      "comparisonId": null, "initialValidity": "candidate", "validity": "confirmed",
      "resolution": "resolved", "projectionVersion": 1,
      "effectiveJudgmentEventId": "event-confirm-0", "successorContextId": null
    },
    "followUps": [{"id": "follow-0", "contextId": "ctx-0", "assertionRevisionId": "ar-0", "openedByEventId": "event-follow-0", "kind": "documentation_update", "status": "open", "resolutionEventId": null}]
  }
}
```

One command advances the context version once even when it appends multiple events; event sequence advances per event. In this fixture the initial confirmation event has sequence 1 and the follow-up opening has sequence 2. Event actor/time are resolved by the server and returned through history, never taken from request fields.

The following are complete command-specific `input` objects within the same envelope. Each row is an independent branch unless its starting version states otherwise; fixture IDs are not real evidence. Success columns describe fields of `result`, not a second response format.

| Case | Input and starting view | Expected result |
|---|---|---|
| Comparison | Active repository view: `{"baseRevision":{"objectAlgorithm":"sha1","commitId":"0000000000000000000000000000000000000000"},"targetRevision":{"objectAlgorithm":"sha1","commitId":"0000000000000000000000000000000000000001"},"inventoryId":"inv-1","configurationId":"config-1"}` | `{"comparisonId":"cmp-1","status":"queued"}`. Later status exposes one review_required outcome for changed assertion `a-0`; `ctx-1/ar-1` is stale/open version 0 at B1, with B0 base and cmp-1. B0 confirmation remains at ctx-0. |
| Incoming reconfirmation | Active ctx-1 view: `{"contextId":"ctx-1","assertionRevisionId":"ar-1","expectedProjectionVersion":0,"decision":"reconfirm","reason":"Incoming source still supports this relationship.","reviewedEvidenceIds":["ev-1"],"contentConcern":null,"followUpDisposition":{"kind":"none"}}` | New judgment, ctx-1 confirmed/resolved version 1, followUps empty. ctx-0 unchanged. |
| Evidence correction | Active ctx-1 version 0: `{"contextId":"ctx-1","assertionRevisionId":"ar-1","expectedProjectionVersion":0,"reason":"Use the correct incoming evidence span.","replacement":{"type":"documents","sourceArtifactId":"doc-0","targetArtifactId":"code-0","sourceVersionId":"doc-v1","targetVersionId":"code-v1","evidenceIds":["ev-corrected"]}}` | Correction event; ctx-1 stale/superseded version 1 with successorContextId ctx-2; ar-2 supersedes ar-1 in a-0. successorProjection ctx-2/ar-2 candidate/open version 0. |
| Endpoint correction | Same starting branch, replacement targetArtifactId `code-2` and targetVersionId `code2-v1`, matching evidence `ev-code2` | New assertion a-2 with supersedesAssertionId a-0, new revision and candidate/open successor. No judgment transfers from a-0. |
| Retirement with missing incoming source | Active ctx-1 version 0: `{"contextId":"ctx-1","assertionRevisionId":"ar-1","expectedProjectionVersion":0,"decision":"retire","reason":"The incoming endpoint was deleted.","reviewedEvidenceIds":[],"contentConcern":null,"followUpDisposition":{"kind":"none"}}` | New retirement event; ctx-1 retired/resolved version 1, zero confirmed support. Missing incoming source stays missing; ctx-0 confirmation and original evidence remain readable where retained. |
| Reversal after follow-up | Continue initial confirmation fixture at version 1: `{"contextId":"ctx-0","assertionRevisionId":"ar-0","expectedProjectionVersion":1,"eventId":"event-confirm-0","reason":"The judgment was recorded against a mistaken interpretation."}` | New reversal event sequence 3; ctx-0 candidate/open version 2, effectiveJudgmentEventId null. follow-0 remains open. event-confirm-0 and event-follow-0 stay in history. |
| Resolve retained follow-up | Continue reversal branch: `{"contextId":"ctx-0","assertionRevisionId":"ar-0","expectedProjectionVersion":2,"followUpId":"follow-0","verificationNote":"Verified the terminology update separately from relationship review."}` | New resolution event sequence 4, ctx-0 candidate/open version 3; follow-0 resolved with resolutionEventId. No confirmation. |

### History and projection reads

Read-context query takes repositoryId and viewId and returns `{view: {viewId, mode, contextId, assertionRevisionId}, projection: ReviewProjection, followUps: FollowUp[], evidence: EvidenceRef[], limitations: string[]}`. The view's mode is read metadata, not stored validity. Current and historical views of retained records share exact immutable identity while access policy remains server-owned.

History query takes `{schemaVersion: "0.1.0", requestId: string, repositoryId: string, viewId: string, contextId: string, cursor: string or null, pageSize: integer >= 1}`. A-LIMITS must set the maximum page size before implementation. First page freezes an event high-water sequence; later appends cannot shift that snapshot. Cursor binds repository/context/view, high-water sequence and last returned sequence; invalid or mismatched cursors fail validation. Events are ordered by ascending context sequence. A next cursor is null only at the end of that snapshot.

Example reversal-branch response at pageSize 2: `result` contains `snapshotSequence: 3`, `items` for event-confirm-0 and event-follow-0, `nextCursor: "cursor-ctx0-through2-at3"`. Next page returns event-reverse-0 (sequence 3) and null nextCursor. Each item is a ReviewEvent plus `references: {artifactVersionIds: string[], evidenceIds: string[]}` and `reversedByEventId: string or null`, evaluated at snapshotSequence. Thus event-confirm-0 names event-reverse-0 even though the reversal is on page two. The new reversal payload names `eventId: "event-confirm-0"`; follow-up payload names follow-0 and its related judgment. Returned exact-version reads preserve missing/unresolved availability, never substituting B1 content for B0. Actor IDs are retained; missing display names remain unavailable.

### Errors, retries and conflicts

Error envelope is `{schemaVersion: "0.1.0", requestId: string, error: {code: string, message: string, details: object}}`. Messages are safe for display and contain no credentials or inaccessible source data. Failed commands commit no domain events, projections, follow-up changes or successful receipt. An uncertain network response is not proof of failure or permission to change requestId.

| Code | Proposed HTTP status | Details and recovery |
|---|---|---|
| unauthenticated | 401 | Empty details; restore trusted session before retry. |
| forbidden | 403 | Empty details; authenticated actor lacks repository command permission. |
| not_found | 404 | Absent or inaccessible referenced object; no cross-repository metadata disclosed. |
| invalid_input | 422 | `fields: string[]`; wrong type/enum, unknown field, blank reason, invalid reference or cursor. |
| historical_context | 422 | Empty details; new write used a historical view. Open an eligible active view explicitly. |
| invalid_transition | 422 | `validity, resolution: string`; command not allowed from authorized current state. |
| missing_evidence | 422 | `evidenceIds: string[]`; exact required evidence unreadable or missing. Keep draft; inspect/reacquire authorized exact input. |
| revision_unavailable | 422 | Unavailable commit supplied for comparison; safe requested CommitRef only. Later missing objects yield partial/failed comparison status. |
| stale_projection | 409 | `currentProjectionVersion: integer`; reload and preserve draft for explicit reconsideration under a new requestId. |
| judgment_conflict | 409 | Latest effective judgment differs, target already reversed, or target is an older judgment; reload history. |
| idempotency_conflict | 409 | Empty details; same request identity with changed input. Inspect original receipt rather than overwrite it. |
| unavailable | 503 | Empty details; retry same requestId. No saved acknowledgment. |

Concrete conflict example: `{"schemaVersion":"0.1.0","requestId":"req-other","error":{"code":"stale_projection","message":"Review state changed. Reload before submitting again.","details":{"currentProjectionVersion":1}}}`. Two new commands against version 0 cannot both commit. The loser preserves its draft; an identical retry of req-confirm-0 returns the original version-1 result even after the reversal branch reaches version 2. Retrying req-confirm-0 after session revocation returns authorization failure, never a leaked receipt.

### Review checks and remaining scope

| Contract case | Proposed delta / planned verification | Layer required later |
|---|---|---|
| Initial active B0 versus historical B0; no inherited B1 confirmation | C-05a, C-07c/e, C-08a/d; T-02/03/14 | Domain + API + browser context recovery |
| Reason, exact versions/evidence, authority and historical write failures | C-05a/b, C-03a; T-03/04/05 | API + actual storage failure |
| Same retry, changed retry input, concurrent state and revoked retry | C-05c; T-04/06/07 | API + transactional storage |
| Evidence/type/endpoint correction and immutable predecessor | C-07a; T-11 | Domain + storage |
| Latest judgment reversal, intervening note, older judgment conflict | C-07b, C-10a/b; T-09/12 | Domain + API + browser |
| Retirement, missing endpoint and independent follow-up completion | C-07d/e, C-10a; T-15/21 and T-09 | Domain + history/API |
| Stable history pagination, exact sources after restart | C-08a/d; T-08/16 | API + restart/storage + browser |

This is a contract consistency mapping, not completed T-/HC- verification or a gstack review. SCHEMA-02 supplies the remaining core command families. A-SCHEMA remains open for acceptance and resolution of referenced policy blockers; backend-generated validation is future implementation evidence. A-STACK, A-AUTH, A-LIMITS, A-DISCOVERY and A-INPUT remain unresolved. tasks.md remains intentionally absent. No unimplemented delta is synchronized into current specs.

## SCHEMA-02: capture, discovery, access and completion draft

Version: 0.1.0, dated 2026-11-11. Status: proposed and unimplemented. SCHEMA-01's types, authorization, write envelope, idempotency rules and safe error envelope apply throughout. This section completes the proposed core command families without approving their policies or selecting technology. Examples use synthetic fixture IDs. Describing a future capture command does not authorize source acquisition now.

### Shared scope and snapshots

| Type | Fields and meaning |
|---|---|
| Selection | `repositoryId: string`, `targetRevision: CommitRef`, `baseRevision: CommitRef or null`, `inventoryId, configurationId: string`. A comparison selection names both revisions; initial review names target only. |
| Coverage | `function: ingestion/extraction/evidence/change_handling/search/graph`, `status: complete/partial/unsupported/unknown`, `eligibleCount: integer or null`, `processedCount: integer`, `excludedCount: integer or null`, `limitations: string[]`. Unknown totals are null, never zero by default. Counts refer to the declared function and inventory, not all project knowledge. Complete means every eligible item was processed for that function. |
| Snapshot | `id: string`, `selection: Selection`, `snapshotVersion: integer`, `provenance: synthetic/real`, `contextVersions: array of {contextId: string, projectionVersion: integer}`, `coverage: Coverage[]`, `pendingReviewCount, openFollowUpCount: integer`, `limitations: string[]`. Immutable; contextVersions, authored-record versions, evidence availability and assertion membership are frozen together. |
| SourceReference | `{kind: "artifact", artifactVersionId: string, locator: line or field locator}` or `{kind: "external", uri: string, label: string, availability: available/missing/unresolved, reason: string or null}`. External metadata is attributed input, never automatically fetched or trusted as verified content. |
| Provenance | `activityId, methodId: string`, `agent: {kind: system/practitioner, id: string}`, `inputVersionIds: unique string[]`, `configurationId: string or null`, `recordedAt: UTC timestamp`, `limitations: string[]`. Assigned by the service from actual capture/processing activity. |
| Operation | `id: string`, `kind: capture/discovery/comparison/export`, `status: queued/running/complete/partial/failed`, `selection: Selection`, `resultSnapshotId: string or null`, `coverage: Coverage[]`, `limitations: string[]`. An accepted operation is not a completed result. |

`select_context` is a read query with Selection input. It resolves already-authorized registered inventory/configuration and returns `{selection, repositoryViewId: string, repositoryViewMode: active/historical, snapshot: Snapshot}`. The repository view has null context/assertion bindings and mode active for an eligible working selection, historical otherwise. It does not register repositories, fetch commits or authorize acquisition. A read snapshot can be issued for historical context without granting any write authority. New initial candidate contexts receive an active review view only if eligible; comparison history remains read-only as in SCHEMA-01.

`open_review_view` is a read query taking `{repositoryViewId, snapshotId, contextId: string}` and returning `{viewId: string, mode: active/historical, contextId, assertionRevisionId: string}`. The context must belong to the snapshot and selected scope. Active mode requires an active repository view, a current snapshot and a nonsuperseded context; otherwise an accessible retained context is historical. No client mode override is accepted. This supplies the viewId used by SCHEMA-01's read-context and review commands, including newly captured or corrected contexts. Snapshot currency is checked again when a new command commits; an identical prior receipt remains governed by retry rules.

Repository writes use the active repositoryViewId. Review writes use their bound review view. Every domain mutation, published processing batch and observable evidence-availability change advances the selection's server-maintained snapshotVersion. Individual review projection versions retain their narrower SCHEMA-01 meaning. `read_snapshot` takes `{selection: Selection}` and returns a new immutable Snapshot of a consistent committed state; selection membership cannot change midway through a query or export. Snapshot IDs refer to retained domain data, not permission grants; reads recheck access. A new snapshot is needed to see later work. Snapshot retention and maximum sizes are A-LIMITS decisions, not an indefinite-retention promise for query cursors.

Completion records, export receipts and operation bookkeeping are metadata around reviewed data: they do not themselves advance snapshotVersion. Publishing new domain results does advance it. Completion checks both the current data version and in-flight operation set atomically, so recording completion cannot invalidate itself. Export admission pins the selected snapshot and its then-retained completion metadata; later completion bookkeeping cannot rewrite an already admitted export.

### Capture and immutable authored records

| Command | Required input within the write envelope | Result and failure boundary |
|---|---|---|
| `capture_files` | `targetRevision: CommitRef`, `inventoryId, configurationId: string` | `{operationId: string, status: "queued"}`. Reads only file entries from an authorized immutable manifest. Arbitrary filesystem roots, URLs, branch tips and client-supplied file bytes are not accepted. |
| `capture_record` | `kind: requirement/decision`, `title, content: string`, `sourceReference: SourceReference or null`, `sourceAbsenceReason: string or null` | `{artifactId, artifactVersionId, activityId: string, recordVersion: 1}`. Title/content nonblank. Null source requires nonblank absence reason; a source requires null absence reason. No relationship is confirmed or silently created. |
| `revise_record` | `artifactId: string`, `expectedRecordVersion: integer >= 1`, `title, content, reason: string`, `sourceReference, sourceAbsenceReason` as above | Same artifact, new immutable version and attributed activity, prior version retained. Version mismatch returns record_conflict. Kind is immutable; a different kind requires a new artifact. Existing reviewed assertions keep their exact old endpoint version. |
| `capture_candidate` | `targetRevision: CommitRef`, `type, sourceArtifactId, targetArtifactId, sourceVersionId, targetVersionId: string`, `evidence: nonempty array of {artifactVersionId: string, locator: line or field locator}`, `reason: string`, `predecessorContextId: string or null` | `{assertionId, assertionRevisionId, contextId: string, evidenceIds: string[], origin: "manual", projection: ReviewProjection, activityId: string}`. All available references and locators resolve in the selected scope; starts candidate/open version 0. Does not alter a discovery run. |

File-manifest entries pin artifact kind, declared format, path, commit and blob identity. The service verifies that identity before capture and computes digests itself. It never executes captured code or follows a symlink/submodule into an undeclared source. A-INPUT must settle the acquisition and exact manifest; A-LIMITS must settle format/encoding/size behavior. Unsupported or unreadable entries yield per-function coverage/limitations. For each entry, identity/version/activity publish atomically; a batch can finish partial without pretending all entries succeeded. Retrying the original request returns the same operation. Repeated processing of that operation cannot duplicate versions or activities.

`read_operation` takes `{operationId: string}` plus repository identity and returns Operation with command-specific results accessible through paginated result queries. Authorization applies to status and results. Queued/running results cannot appear complete. A failed operation may retain earlier atomically published entries but must identify that scope; failure of one entry cannot leave half of its domain records published. This differs from a rejected synchronous write, which commits no domain change. Admission and its receipt commit atomically; the operation status records later processing failure. Comparison admission follows the same rule.

`read_capture_results` takes `{operationId: string, cursor: string or null, pageSize: integer >= 1}`. Result is `{operation: Operation, items: array of {path: string, artifactId: string or null, artifactVersionId: string or null, outcome: captured/unavailable/unsupported, coverage: Coverage[], provenance: Provenance or null, reason: string or null}, nextCursor: string or null}`. Captured entries require IDs/provenance; unsuccessful entries identify their declared input and reason without inventing a captured version. First-page result membership is frozen, ordered by declared manifest path. In-progress results disclose their published boundary and require a new first-page query to see later entries. Cursor/page constraints match the other result reads.

Candidate input does not accept actor, confidence, method or origin overrides. The service records practitioner/manual provenance. Same type and stable endpoints reuse the assertion identity; identical versions/evidence reuse existing candidate identity rather than resetting a judgment. Changed evidence on an existing active assertion requires correction/revalidation, not a second manual candidate that bypasses a terminal judgment. An explicit successor after rejection/retirement requires predecessorContextId naming that terminal context; the new assertion retains its predecessor reference and starts candidate/open. Superseded contexts instead point to their existing successor. A candidate for authored records still identifies the selected repository revision and exact authored version; it does not invent a Git commit for the record.

The explicit terminal-successor path is the exception to normal same-endpoint assertion reuse. It checks the predecessor's current terminal state atomically and deduplicates identical successor captures against their predecessor/type/endpoints/versions/evidence. A null predecessor cannot bypass a retained terminal outcome. Conflicting capture or concurrent reversal returns invalid_transition or a projection conflict with accessible current state; it never resets the predecessor.

`read_artifact_version` takes `{artifactVersionId: string}`; `read_evidence` takes `{evidenceId: string}`. Each query additionally names repositoryId and snapshotId and returns `{record: FileVersion or RecordVersion or EvidenceRef, availability, reason, content: string or null, provenance: Provenance, limitations: string[]}` in the standard result envelope. Content is present only when available and allowed by the support profile. Evidence content is the resolved excerpt; artifact content is the exact retained version. An unavailable known source is a successful metadata read with null content, not a fabricated empty string. An absent/inaccessible record returns not_found. Large-content paging and excerpt bounds are A-LIMITS blockers; truncation cannot be presented as the full source. Snapshot availability is frozen metadata; if content becomes unavailable since then, disclose the live retrieval failure separately and never substitute another version.

### Automatic discovery

`discover_candidates` input is `{targetRevision: CommitRef, inventoryId: string, configurationId: string}` in an active repository write envelope. Result is `{operationId: string, status: "queued"}`. Configuration identifies the exact method version and parameters; the command cannot submit per-run tuning that is absent from the frozen configuration. A-DISCOVERY remains open; this contract does not select P-08.

`read_discovery_results` is a paged read with `{operationId: string, cursor: string or null, pageSize: integer >= 1}`. Result is `{operation: Operation, methodId: string, items: array of {assertionId, assertionRevisionId, contextId: string, evidenceIds: string[], origin: "automatic", provenance: Provenance}, coverage: Coverage[], nextCursor: string or null}`. The first page freezes the published run-result boundary. An empty completed result means no qualifying match within processed scope, not no relationship. A partial/unknown result retains excluded scope and reasons. Existing judgments are not overwritten if the run encounters an already reviewed exact assertion revision; the result references the retained context and does not count it as a newly confirmed relationship.

Automatic match inventory and later manual captures have independent provenance and result membership. Manual capture after a miss cannot change that run's empty result into a hit. Reprocessing a run deduplicates by run, typed pair and exact version/evidence identity; retry cannot duplicate contexts. Independent runs can reference retained assertion revisions without resetting review history. Discovery and comparison publish immutable incoming contexts; if a predecessor changes during processing, the publisher must check its recorded projection version atomically and report a conflicted/partial outcome rather than overwrite a correction or retirement.

### Search and typed graph reads

All queries use `{schemaVersion, requestId, repositoryId, query: string, input: object}`. requestId correlates a read and is not a write receipt. Shared page inputs are `snapshotId: string`, `cursor: string or null`, `pageSize: integer >= 1`. Cursors bind the complete query, sort order, snapshot and repository; a changed query requires a new first page. Unknown or expired cursors return invalid_input with a safe field path. Access loss is checked on every page. Page size, result limits, query length and operation duration await A-LIMITS.

| Query | Input beyond shared page fields | Result |
|---|---|---|
| `search_records` | `text: string`, `kinds: unique array of code/document/requirement/decision`, `matchMode: "literal"` | `{snapshotId, items: SearchHit[], coverage: Coverage[], nextCursor: string or null, limitations: string[]}`. Nonblank text; nonempty kinds. Proposed first contract uses Unicode case-folded literal substring over path/title and supported captured text. No semantic ranking or accuracy claim. |
| `read_graph` | `rootArtifactId: string`, `relationTypes: unique nonempty string[]`, `direction: incoming/outgoing/both`, `depth: 1` | `{snapshotId, nodes: GraphNode[], edges: GraphEdge[], coverage: Coverage[], nextCursor: string or null, limitations: string[]}`. A typed one-hop neighborhood read; no inferred transitive impact. |
| `read_assertion` | Nonpaged input `{snapshotId: string, assertionRevisionId: string, contextId: string}` | `{snapshotId, assertion: AssertionRevision, projection: ReviewProjection, evidence: EvidenceRef[], followUps: FollowUp[], provenance: Provenance, historyViewId: string, limitations: string[]}`. IDs must belong to the snapshot and each other. |

SearchHit is `{artifactId, artifactVersionId: string, kind: code/document/requirement/decision, label: string, path: string or null, matches: array of {field: path/title/content, locator: line or field locator or null, excerpt: string}, availability, limitations: string[]}`. Results sort by artifactId then artifactVersionId for stable pagination; search scoring is absent. No excluded record identity/count is disclosed beyond the actor's accessible scope. A search miss with inaccessible or unsupported scope reports incomplete coverage without claiming nothing relevant exists. Snapshot membership pins all versions; search does not read an uncontrolled live worktree.

GraphNode is `{artifactId, artifactVersionId: string, kind, label: string, representationOnly: boolean, availability, limitations: string[]}`. GraphEdge is `{assertionId, assertionRevisionId, contextId, sourceArtifactId, sourceVersionId, targetArtifactId, targetVersionId: string, type: string, validity, resolution, evidenceIds: string[]}`. Only edges with both versioned endpoints in the readable snapshot are drawn; missing/unresolved endpoints remain explicit outcomes/limitations linked to their review contexts, not invented graph nodes. Each page includes the nodes needed to interpret its edges, even if a node repeats across pages. Edge pagination is stable by assertionRevisionId/contextId. The graph read is never allowed to silently hide unresolved context from the selected snapshot's review summary. Edge counts are representation counts, not confirmed coverage.

### Completion and export

`complete_cycle` uses an active repository write envelope and input `{snapshotId: string, expectedSnapshotVersion: integer, acknowledgedLimitations: string[]}`. The server verifies the snapshot belongs to that view's selection and is still current under the same atomic boundary as the completion/receipt. pendingReviewCount must be zero. Candidate/stale open contexts count as pending; superseded predecessor contexts do not. Independent open follow-up does not prevent review completion and remains disclosed. Complete review does not assert that content is corrected, all relationships were found or processing coverage is complete.

Acknowledgment must list the exact limitation strings retained in that snapshot, without duplicates; order is immaterial for this validation (idempotency input equality still preserves array order). Partial/unknown processing can be acknowledged, but cannot become a complete processing claim. In-flight capture/discovery/comparison work affecting that selection blocks completion because the review set is not settled. Result is `{completionId, snapshotId, actorId: string, recordedAt: UTC timestamp, acknowledgedLimitations: string[], pendingReviewCount: 0, openFollowUpCount: integer}`. New work/reversal creates a new snapshot and changes current completion eligibility without deleting the earlier completion. A repeated new completion command for the same snapshot returns its retained completion identity, not a second completion event.

`export_snapshot` is a write only in the sense of creating a retained export artifact/receipt; it does not mutate judgments. Input is `{snapshotId: string, format: "json"}`. It may use an authorized historical repository view bound to the same selection. This is an explicit exception to SCHEMA-01's historical new-write prohibition for domain mutations: exporting retained history does not make it editable. Current repository read/export permission is required; the exported snapshot need not be current or complete. Result is `{operationId: string, status: "queued"}`. `read_export` takes `{operationId: string}` and returns `{status, exportId: string or null, snapshotId: string, digest: digest or null, document: ExportDocument or null, limitations: string[]}`. Document and digest are non-null only for a complete export. Export size limits are an A-LIMITS prerequisite; oversized output fails explicitly rather than silently dropping fields. No public download URL, sharing or deployment is implied.

ExportDocument is `{schemaVersion: "0.1.0", exportId, snapshotId: string, snapshotVersion: integer, selection: Selection, provenance: synthetic/real, releaseRecordId: string or null, judgments: array, followUps: FollowUp[], historyReferences: array, coverage: Coverage[], completion: completion record or null, limitations: string[]}`. Each judgment item contains exact AssertionRevision, ReviewProjection, EvidenceRef list and effective ReviewEvent or null. History references retain event/context/assertion/version identities needed for retrieval; an export is not a standalone archive of every source byte. The distinction is disclosed. Export limitations also identify any source content that cannot now be retrieved. Unavailable release metadata stays null with a limitation, never an invented build label. Both incomplete review and open follow-up are visible. Identical operation retry returns one export artifact and digest; source or snapshot changes cannot alter its frozen document after publication.

The concrete judgment item keys are `{assertion: AssertionRevision, projection: ReviewProjection, evidence: EvidenceRef[], effectiveEvent: ReviewEvent or null}`. A history reference is `{eventId, contextId, assertionRevisionId: string, artifactVersionIds: string[], evidenceIds: string[]}`. The completion object has the complete_cycle result fields above. JSON export bytes and their SHA-256 digest are fixed together at publication; serialization must be stable for retry of that export artifact, without imposing a storage-specific JSON representation.

`read_release_record` takes `{releaseRecordId: string}` and returns `{id, softwareVersion, buildId, configurationId: string, language: "Python", documentFormats: ["Markdown", "plain-text"], dependencies: array of {name, version: string}, operatingRequirements: string[], supportMatrix: array of {function: string, status: proposed/implemented/partially_implemented/unsupported/unknown, limitations: string[]}, verificationReferences: string[], guidedTaskIds: string[], limitations: string[]}`. This is read-only disclosure of a separately prepared release record; it does not invent a runnable release or authorize participant administration.

### Additional error details

SCHEMA-01 errors remain unchanged except that unavailable scope may finish as an operation result rather than a synchronous rejection. New proposed errors are `record_conflict` (409, currentRecordVersion), `snapshot_conflict` (409, currentSnapshotVersion), `pending_review` (409, pendingReviewCount), `processing_active` (409, operationIds in accessible scope), and `limit_exceeded` (422, limitName and configured maximum/unit). IDs/counts are disclosed only after access checks. Invalid acknowledgment lists return invalid_input. Unknown manifest/configuration or cross-repository snapshot IDs return not_found. Historical export does not grant domain write permission. A 503 before admission has no accepted receipt; uncertain delivery still requires retrying the same requestId to establish the outcome.

### Synthetic examples and contract review

Each row supplies the complete command/query-specific input for the named operation, using the common envelope. Scope fixture IDs refer to previously authorized synthetic records; no real manifest or successful integration is implied.

| Case | Input | Expected result boundary |
|---|---|---|
| File capture | `{"targetRevision":{"objectAlgorithm":"sha1","commitId":"0000000000000000000000000000000000000001"},"inventoryId":"inv-1","configurationId":"config-1"}` | capture_files returns operationId/status queued. A later unsupported text entry yields partial extraction coverage, not a false complete batch. |
| Authored decision without external source | `{"kind":"decision","title":"Keep review separate from follow-up","content":"A relationship may remain valid while documentation work is open.","sourceReference":null,"sourceAbsenceReason":"Researcher-authored demonstration record."}` | capture_record creates version 1 with server-attributed provenance; no confirmed link. |
| Record revision | `{"artifactId":"decision-1","expectedRecordVersion":1,"title":"Separate relationship review and follow-up","content":"Record each outcome independently.","reason":"Clarify the earlier wording.","sourceReference":null,"sourceAbsenceReason":"Researcher-authored demonstration record."}` | revise_record creates version 2. An old reviewed assertion still refers to version 1. Concurrent version-1 revision conflicts. |
| Manual successor after retirement | `{"targetRevision":{"objectAlgorithm":"sha1","commitId":"0000000000000000000000000000000000000001"},"type":"documents","sourceArtifactId":"doc-0","targetArtifactId":"code-0","sourceVersionId":"doc-v1","targetVersionId":"code-v1","evidence":[{"artifactVersionId":"doc-v1","locator":{"kind":"lines","startLine":3,"endLine":4}}],"reason":"Propose a distinct claim after the recorded retirement.","predecessorContextId":"ctx-retired"}` | capture_candidate creates explicitly linked successor candidate; it cannot restore the old confirmation or alter automatic results. |
| Automatic discovery | `{"targetRevision":{"objectAlgorithm":"sha1","commitId":"0000000000000000000000000000000000000001"},"inventoryId":"inv-1","configurationId":"config-1"}` | discover_candidates returns one operation. A later manual capture leaves this run's original automatic hit/miss result unchanged. |
| Search with unsupported scope | `{"snapshotId":"snap-1","cursor":null,"pageSize":20,"text":"review","kinds":["document","requirement"],"matchMode":"literal"}` | search_records returns matching exact versions, or empty items with partial/unknown coverage when some scope was not searchable. |
| Typed graph | `{"snapshotId":"snap-1","cursor":null,"pageSize":20,"rootArtifactId":"doc-0","relationTypes":["documents"],"direction":"outgoing","depth":1}` | read_graph returns directed document-to-code edges with exact revisions/validity. Missing endpoints remain in disclosed unresolved context. |
| Completion with independent work | `{"snapshotId":"snap-reviewed","expectedSnapshotVersion":8,"acknowledgedLimitations":["Some eligible text could not be extracted."]}` | complete_cycle succeeds only if this is still the current settled snapshot with zero pending review; open follow-up stays disclosed and extraction stays partial. |
| Historical export | `{"snapshotId":"snap-old","format":"json"}` | export_snapshot creates a retained JSON export for snap-old with its own completion, limitations and synthetic/real provenance. Later current review changes cannot rewrite it. |

| Planned verification | Added contract boundary | Required future evidence |
|---|---|---|
| T-03/04/10/16/23/24, HC-01/02/06 | Manifest-only capture, attributed immutable records and source reads | Authorized fixture/domain/API checks, then exact real-input processing; restart persistence |
| T-06/07/13/18/25, HC-02D/07 | Operation admission, partial publication, independent automatic/manual results | Storage failure/retry/concurrency plus frozen discovery inputs |
| T-19/20, G-01/G-04 | Snapshot-bound literal search, typed graph and unresolved scope | API/read-model checks plus existing-UI browser inspection |
| T-09/12/18/22, HC-08 | Completion snapshot race, incomplete processing acknowledgment and historical export | Atomic completion/storage checks, export inspection and UI recovery |

Coherence review: this draft preserves the proposal's four capabilities and C-01 through C-10, leaves X-01 through X-03 outside scope, and preserves PRODUCT.md/DESIGN.md. It refines the earlier historical-write rule only for non-mutating retained export. It supplies the previously missing terminal-successor capture path and separates synchronous rejection from later partial operation failure. OpenSpec/JSON/whitespace checks can verify document structure and example syntax only. No gstack, functional, browser, storage or Healthchecks pass is claimed.

Readiness: all core command families now have a proposed shape, but A-SCHEMA is not accepted or implemented. Concrete limits, support/encoding rules, relation registry, discovery configuration and acquisition manifest still require resolution before executable schemas/tasks. STACK-01 and AUTH-01 below propose backend/storage and authentication choices; neither is accepted or verified. No dependencies, service scaffolds or migrations follow from this document.

## STACK-01: backend and storage decision draft

Version: 0.1.0, dated 2026-11-11. Status: proposed, unimplemented, awaiting acceptance. Recommend one Python/FastAPI application and PostgreSQL as the authoritative store, with SQLAlchemy transactions, Psycopg and schema validation generated from typed request/response models. This is a deliberate backend proposal, independent of the accepted Python test-input language. The existing React/Vite frontend stays in apps/web; a later separately scoped service adapter consumes the contracts. No Next.js replacement, browser-data migration or installed backend is assumed.

The decision follows the bounded command contracts: immutable records, accountable events, optimistic review versions, repository permission checks and retry receipts must agree in one transaction. Typed graph representation is a domain requirement; this proposal represents it using artifact/version/assertion tables and explicit directed endpoints. One-hop graph reads and snapshot-bound search do not require a second authoritative store. This is an engineering judgment for the first bounded runtime, not a claim that PostgreSQL outperforms a graph database.

### Alternatives and selection boundary

| Candidate | Fit and trade-off | Proposed disposition |
|---|---|---|
| FastAPI with PostgreSQL | One application can expose typed JSON contracts; one transactional store holds domain, permissions, operations and receipts. Requires a database service and a verified runtime/driver combination. | Recommended first backend, pending acceptance and compatibility evidence. |
| FastAPI with SQLite | A lower-setup candidate for a local single-host application. SQLite allows only one writer at a time; concurrent command/processing behavior needs a separate verification profile. This is not a claim that SQLite lacks transactions. | Retain as a deployment simplification alternative if a strictly local workload becomes the accepted requirement; do not use it as a substitute for PostgreSQL acceptance tests. |
| FastAPI with Neo4j as the sole domain store | Native graph model and transactional writes are viable. Would need an equally concrete schema for event order, retry uniqueness, session/grant checks and review version conflicts. No local Neo4j installation is assumed. | Retain as a manuscript-shortlist alternative. Choose it instead if graph-native storage becomes an explicit requirement or measured query needs justify it; graph visualization alone does not settle that choice. |
| PostgreSQL plus Neo4j projection | Can separate retained commands from graph query projections, but introduces publication/rebuild/lag semantics across stores. | Defer until a measured requirement warrants the added consistency boundary. |
| Django with PostgreSQL | A credible alternative if integrated account administration becomes central. Would change framework conventions while preserving the contracts. | Not proposed for the bounded API-first slice; no unsupported performance or security comparison is implied. |

The manuscript's technology shortlist is background, not a binding installed stack. This draft leaves its earlier review history intact and records the proposed deviation from Neo4j explicitly. Acceptance of PostgreSQL would require updating the active architecture decision and later research implementation disclosures; it would not rewrite the source manuscript or claim a graph-native database was used.

Candidate compatibility baseline: Python 3.13, PostgreSQL 18, SQLAlchemy 2.x, Psycopg 3.x, and mutually compatible FastAPI/Pydantic releases. These are candidate version families, not a tested lockfile. Before technology-specific tasks, record exact resolved versions, Python/OS support, licenses, installation commands and a transaction smoke-check plan. Before implementation completion, run that plan on the named target environment. Do not change frontend package/lockfiles to install backend tools. Any future backend path and packaging files need an explicitly bounded implementation scope; none is created here.

### Runtime and durability boundary

Start with one application process, synchronous short database command transactions and a single supervised processing loop in that application. Accepted jobs live in PostgreSQL; an in-memory queue or untracked background callback is not their durable identity. Long Git reading, capture, discovery and export serialization occur outside a database transaction; bounded results publish through short transactions. A database-backed lease with a fencing generation guards job ownership. A-LIMITS must settle lease/heartbeat durations, retry counts, concurrency, source bytes and job deadlines before this is executable. A later separate worker or Redis/RQ deployment requires an explicit operating need and reviewed delivery semantics.

Retained source bytes, record content and published export bytes initially belong to the same database durability boundary as their identities/digests. This avoids promising atomicity between a file write and a database commit. Database capacity, byte limits and backup size are costs to settle under A-LIMITS. The Git acquisition remains an independently authorized read-only input; retaining a locator alone cannot prove source survives restart or Git object loss. Temporary processing state never counts as published evidence. A later external object store requires its own staging/publication/recovery contract.

Snapshot storage needs explicit immutable membership/version rows or retained materialized read models. A PostgreSQL transaction snapshot that ends with the HTTP request is not sufficient for cross-request historical pagination. Publication freezes membership, review projections, evidence metadata and history sequence bounds under the selection lock. Source content and history reads use those retained references; permissions are checked live. Search normalization must match SCHEMA-02's case-folded literal semantics, not silently inherit a database collation's different behavior.

### Transaction contract

Proposed command algorithm, using a single SQLAlchemy transaction and PostgreSQL row locks:

1. Resolve the session/actor, verify CSRF for browser writes, then lock and recheck account, session and repository membership as described in AUTH-01. A missing or revoked actor fails before receipt lookup or inaccessible reference disclosure.
2. Establish a consistent lock order: account, session when present, repository grant, selection, then review contexts in sorted ID order, followed by job/receipt records. Use compatible shared locks for authority reads; revocation/role changes must obtain conflicting locks. All domain publishers, completion checks and job admissions take the selection lock so admission/completion races cannot pass independently.
3. Check the unique receipt scope `(actorId, repositoryId, command, requestId)`. Return an identical committed receipt before live projection/view checks; changed canonical input conflicts. Concurrent identical requests serialize and return one result. A unique constraint is the final duplicate guard, not an application-only lookup.
4. For a new command, check view bindings, current snapshot when required, expected review/record version and allowed transition. Validate all repository-scoped foreign references, evidence identity and required readability. Version mismatch changes no domain state.
5. Append immutable event/version rows; update projections and selection version as required; insert the exact response receipt. Correction publishes predecessor and successor together. Completion checks settled operations and current snapshot under the same lock; its own metadata does not advance reviewed-data version.
6. Commit before acknowledging saved. Roll back the entire command on any error. A lost commit response remains uncertain delivery and must be resolved with the original request identity. Bounded deadlock/serialization retry may repeat the whole transaction with the same identity, never just the final insert.

Schema guards include unique `(contextId, sequence)`, unique receipt scope, unique assertion/comparison context identity, immutable version identities, typed endpoint compatibility, and repository-qualified references. A service database role cannot update/delete retained review events through ordinary commands. Administrative migration privileges are separate. Constraints/locks enforce command consistency but are not evidence of tamper-proof storage against a database administrator.

Job admission plus receipt is atomic; later each publication batch plus its operation checkpoint, fencing generation and snapshot advancement is atomic. On restart, expired leases may be reclaimed under a new generation; an older owner cannot publish afterward. A correction/retirement that invalidates a recorded predecessor version yields an explicit partial/conflicted outcome. Once admitted, status changes are inspectable even if the requester loses access; new publication requires the requester's active account and current required repository permission. Revoked work stops before another domain publication. Earlier committed batches/history remain retained.

### Required storage evidence

| Gate | Planned action and required observation | Existing verification mapping |
|---|---|---|
| ST-01 | Inject failure between event, projection, successor/follow-up and receipt writes. No subset survives; retry commits once. | T-05/06/07, HC-07 |
| ST-02 | Two actual database connections submit different commands at the same expected version. One commits; one conflicts with its draft retained. Identical concurrent retries return one receipt/event set. | T-06/07, HC-07 |
| ST-03 | Lose the response after commit, restart the application, retry the original identity. Original response and exact retained source remain recoverable. | T-06/16, HC-06/07 |
| ST-04 | Race correction, job publication, revocation and completion at transaction barriers. Defined lock order/guards prevent stale publication or unauthorized post-revocation commit. | T-04/07/09/11/12, HC-05/07 |
| ST-05 | Kill/restart processing after admission and after a publication checkpoint. Job resumes without duplicate contexts; stale lease generation cannot publish. | T-06/14/16, HC-04/06/07 |
| ST-06 | Restore an isolated database backup and inspect versions, events, memberships, receipts, source bytes and snapshot pagination. Revoke restored sessions before use. | T-08/16, HC-06 |

These gates require the chosen real database and fault/concurrency injection. SQLite, mocked repositories, a successful build or document validation cannot satisfy them. Host power-loss durability is a separate storage configuration and failure test; an application restart does not prove it. Backup/restore procedures must be reviewed before any future deployment, with no production restore or migration authorized here.

## AUTH-01: trusted identity and repository authorization draft

Version: 0.1.0, dated 2026-11-11. Status: proposed and unimplemented. Recommend pre-provisioned named accounts, Argon2id password verification, opaque server-held sessions and repository-specific viewer/reviewer grants for the bounded demonstration. This adds an explicit trusted identity boundary to the proposed backend; the current fixture personas remain synthetic UI behavior until a later integration delta. No service account, real user account, password, grant or session is created now.

### Alternatives and account lifecycle

Opaque sessions allow the service to recheck revocation and permission in the same store/transaction as review commands. Self-contained access tokens would still need current server-side grant/revocation checks to meet this contract, so JWT does not simplify the initial boundary. External OpenID Connect login is a credible alternative when an institutional provider, deployment origin and approved identity mapping are available; those are not supplied here. A future OIDC subject must map to the same stable actor IDs and explicit grants. Trusted reverse-proxy headers require a separately defined proxy trust boundary. Client personas, arbitrary actor headers and anonymous shared reviewer accounts do not establish accountable authority.

Operator-controlled provisioning/revocation is outside ordinary repository commands and outside this implementation authorization. Propose a separately scoped local administrative tool with audit records, no public signup, no role-changing product API and no shared default credentials. Named accounts receive individually generated credentials through an approved private channel; no credentials appear in specs, URLs, command history or demo fixtures. Password reset is an operator action that revokes every session; deleted/disabled accounts leave stable actor references on old events. Repository ownership and actual operator authority must be accepted before provisioning can be implemented.

Proposed hashing baseline: Argon2id with at least 19 MiB memory, 2 iterations and parallelism 1, unique library-generated salt, and stored algorithm/cost metadata. Final cost can increase after target-host measurement, never silently fall below the reviewed floor. Password verification must not run while domain rows are locked; the transaction rechecks the credential version and account status before issuing a session. Credential generation, length/input bounds and login throttling are explicit A-LIMITS follow-up policies; they must be settled before a runnable login endpoint. This draft does not invent an approved password distribution channel or require email integration.

### Session and browser boundary

| Element | Proposed contract |
|---|---|
| Token | At least 32 cryptographically random bytes, opaque and rotated at login/re-authentication. Store only its one-way digest with actorId, credentialVersion, createdAt, lastSeenAt, absoluteExpiresAt and revokedAt. Never store the raw token in logs or localStorage/sessionStorage. |
| Cookie | Host-only `__Host-continuum_session`, HttpOnly, Secure, SameSite=Lax, Path=/, no Domain attribute. Browser credential is a cookie, not a role or actor request field. |
| Expiry | Proposed 30-minute idle timeout and 8-hour absolute timeout, enforced server-side. Requests at/after expiry fail 401; activity cannot extend the absolute deadline. These are proposed values requiring acceptance, not measured usability results. |
| Logout/reset/disable | Revoke server session(s) and clear cookie. Session replay afterward fails, including receipt/history/export reads. Account disable/reset revokes all sessions; role downgrade changes command permission immediately. |
| Origin | Future browser and API share one explicitly allowed HTTPS origin with relative `/api/v1` routes. No wildcard credentialed CORS. Exact hostname/certificate/hosting remain deployment decisions. An insecure local development profile, if needed, must be separately explicit and cannot count as secure-cookie acceptance. |
| CSRF | Session-bound synchronizer token, delivered only to same-origin clients, sent in `X-CSRF-Token` for every browser POST/domain write/logout. Validate allowed Origin and JSON content type; missing/invalid token or foreign Origin returns forbidden. SameSite supplements these checks. Never use GET for domain mutations. |
| Login CSRF | A same-origin bootstrap creates a short-lived anonymous pre-session with CSRF token before credential submission. Replace that pre-session entirely on successful login; it confers no repository permission. Proposed bootstrap lifetime is 10 minutes. |
| Recovery | Expiry or permission failure preserves the local unsent draft under its exact context. After re-authentication refresh authority/projection before resubmission; original uncertain delivery retries keep the original requestId. No anonymous fallback to the first fixture user. |

Session metadata updates do not advance domain snapshotVersion. Session/grant revocation has a defined transaction order: if revocation commits first, a waiting command must fail after rereading authority; if the authorized command commits first, its event remains attributable and later commands fail. The system does not promise to erase an already committed valid decision when access is subsequently revoked. Workers use a server-resolved processing identity for provenance and recheck the initiating actor's grant at publication, not a copied client role.

The anonymous pre-session uses a separate `__Host-continuum_pre` cookie with the same host-only/Secure/HttpOnly/SameSite/Path restrictions and its own CSRF state. Invalid/unknown logins perform an equivalent password-verification path using a dummy hash when needed, while applying the same accepted throttle policy. No response claims constant execution time; AU-06 must inspect practical enumeration differences. Session recovery never replays stored passwords from a domain receipt.

### Repository permission matrix

Roles are explicit current grants keyed by stable account/repository identity. There is no implicit first-member fallback, global reviewer flag or authority from repository/view IDs. Unknown membership denies access. A viewer may inspect/export authorized context; a reviewer may additionally perform the listed bounded domain commands. Both remain subject to active/historical view rules and source-acquisition policy.

| Command family | Viewer | Reviewer | Additional boundary |
|---|---|---|---|
| Selection, snapshot, artifact/evidence, operation status/results, search, graph, assertion/history and release-record reads | Allow | Allow | Query every nested object within accessible repository scope; recheck access on pagination and retry. |
| Retained snapshot export and export retrieval | Allow | Allow | Historical export allowed, no domain edits. Export operation admission also checks CSRF. |
| Capture/revise authored records and manual candidate/successor capture | Deny | Allow | Exact scoped references; no client origin/actor override. |
| Capture files, automatic discovery, selected revision comparison | Deny | Allow | Registered authorized immutable input only. Grant does not authorize cloning or arbitrary local reads. |
| Judgment, correction, reversal, follow-up open/resolve and cycle completion | Deny | Allow | Current guards, expected versions, reasons/evidence and active views. |
| Provision accounts, grant roles, acquire/register external source, migrate or deploy | Deny | Deny | Separate operator-controlled procedure; neither product role confers this authority. |

Every API path uses the same fail-closed authority dependency; per-command validation is not a substitute for it. Unknown/expired/disabled sessions return unauthenticated; an authenticated account without the required repository command grant returns forbidden. Inaccessible child IDs return not_found without echoing their identities, source excerpts, counts or membership. A forged client role/actor field is invalid input and cannot elevate a viewer; all immutable events use the server-resolved actor. Authorized retry still validates CSRF/session/grant before disclosing a committed receipt.

### Proposed authentication interface

These routes are transport proposals for later API generation, not implemented endpoints. Authentication is separate from SCHEMA-01's repository-command envelope and does not accept repositoryId/viewId/actorId/role as login authority. Responses use schemaVersion/requestId and safe result/error envelopes. Account/session lifecycle events are a separate security audit stream and do not become relationship judgments.

| Route | Input | Success / failure |
|---|---|---|
| GET `/api/v1/auth/bootstrap` | Same-origin request, no credentials in URL | Pre-session cookie plus `{csrfToken: string, expiresAt: UTC timestamp}`; no actor/grant data. No-store response. |
| POST `/api/v1/auth/login` | `{schemaVersion: "0.1.0", requestId: string, login: string, password: string}` plus bootstrap cookie, CSRF header and allowed Origin | New session cookie and `{actorId: string, displayName: string, absoluteExpiresAt: UTC timestamp}`. Invalid/unknown/disabled credentials share a generic unauthenticated result; rate limit uses 429 with safe retry metadata. Login creates no repository grant. |
| GET `/api/v1/auth/session` | Current session cookie | `{actorId: string, displayName: string, csrfToken: string, absoluteExpiresAt: UTC timestamp}` or 401. Grants are evaluated against the selected repository rather than asserted by this response. No-store response. |
| POST `/api/v1/auth/logout` | Current or already-cleared session plus valid same-origin CSRF flow | Revoke current session where present, clear cookie and return `{signedOut: true}`. An expired/absent session can clear the browser cookie without disclosing prior session state; foreign Origin cannot force authenticated logout. |

Passwords/session tokens/CSRF tokens never enter idempotency receipts or general request-body logs. Login/logout are lifecycle operations, not replayable domain commands; repeated login may issue a new session and is subject to throttle policy. Reused requestId cannot replay a login token or bypass expiry. Security audit retains safe event type, stable actor when known, server time and outcome; retention, IP handling and throttling values must be accepted under A-LIMITS before implementation.

### Required authentication evidence

| Gate | Required future observation | Mapping |
|---|---|---|
| AU-01 | Missing/expired/disabled/unknown session fails for every command family and nested read. Client persona/actor/role cannot grant permission. | C-05a/d/e, T-04, HC-03 |
| AU-02 | Viewer can read/export but cannot capture, discover, compare or mutate review/follow-up/completion. Reviewer for repository A cannot read/write repository B through IDs, cursors, receipts, snapshots or job/export results. | C-05d, C-08b/d, T-03/04/19/20 |
| AU-03 | Same-origin browser verifies secure/HttpOnly host cookie, CSRF rejection, login pre-session replacement, logout and both timeouts. Browser storage contains no service credentials. | C-05e/f, T-04/17; separate browser/session acceptance |
| AU-04 | Revoke/downgrade actor while a command and queued job wait at transaction barriers. No publication or receipt disclosure after revocation wins; earlier committed history remains intact. | C-05d, T-04/06/07/16, HC-03/06/07 |
| AU-05 | Restart service and retry uncertain delivery under the same valid actor; receive one prior result. Expired/revoked credentials cannot retrieve that result. Reset credentials revokes older sessions. | C-05c/e, T-04/06/16, HC-06/07 |
| AU-06 | Invalid login is generic, throttled under accepted limits, and logs/receipts contain no credential material. Real login and fixture persona modes cannot authenticate each other. | T-04; security audit and adapter/browser checks |

### Technical references and disposition

Official sources checked read-only on 2026-11-11 informed these proposals. They establish documented mechanisms, not compatibility or performance of this project. The exact architecture, lock order, role matrix, timeout values and verification gates are proposed engineering decisions.

- [FastAPI security concepts](https://fastapi.tiangolo.com/tutorial/security/) and [worker deployment](https://fastapi.tiangolo.com/deployment/server-workers/) describe framework/security and process options; they do not provide this project's authentication implementation.
- [PostgreSQL row-level locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS) document conflicting row-lock behavior; [SQLAlchemy transaction framing](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html) documents commit/rollback boundaries. ST-01 through ST-06 must still verify the proposed algorithm.
- [SQLite deployment guidance](https://www.sqlite.org/whentouse.html) explains its single-writer constraint; [Neo4j driver transactions](https://neo4j.com/docs/python-manual/current/transactions/) establish transactional support for that alternative. Neither source proves or rules out suitability for the accepted demonstration.
- [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), and [CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) support the session, password-hash and synchronizer-token mechanisms. The selected durations and provisioning model remain this proposal's choices.

A-STACK and A-AUTH now have concrete recommendations and alternatives; both remain proposed, with compatibility, policy acceptance and live verification outstanding. A-LIMITS, A-DISCOVERY and A-INPUT remain open. No implementation tasks, backend packages, database instances, accounts, services or deployment changes were created. Next planning work is to settle operating/authentication limits and discovery configuration, then the authorized Healthchecks input manifest, before approving a bounded implementation design.
