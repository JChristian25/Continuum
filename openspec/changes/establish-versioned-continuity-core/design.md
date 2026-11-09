# Design

## Context

See proposal.md for the intent and the four capability deltas for proposed behavior. This is a draft technical design during specification work. It is not implementation-ready: the blocking decisions below must be resolved before a bounded implementation task is authorized.

The only implementation baseline is this project's React/Vite frontend. `src/data/workflow.js` stores judgments on fixture artifacts; `src/context/ContinuumContext.jsx` manages browser state and client personas. `src/data/state.js` suppresses storage errors. `src/components/Inspector.jsx` combines baseline and incoming history, and `src/components/ReviewSummary.jsx` uses fixed sample repository/revision labels. Those are observed limitations, not existing service contracts.

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
| A-STACK | Backend language/framework and storage with required atomicity | Reviewed technology decision and transaction verification plan |
| A-AUTH | Trusted identity, session and repository permission mechanism | Reviewed command authorization contract and negative cases |
| A-SCHEMA | Final request/response, projection and error schemas | Versioned examples for initial review, comparison, correction, reversal, history and conflicts |
| A-LIMITS | File, byte, candidate, page and operation-duration limits | Named values/units, partial/failure behavior and boundary tests |
| A-DISCOVERY | Concrete first discovery method and support depth | Versioned method/configuration and independent expected outcomes |
| A-INPUT | Authorized Healthchecks acquisition, exact commits and eligible Python/Markdown/plain-text inventory | Reproducible input manifest without consulting other local folders |

This initial OpenSpec setup records those prerequisites rather than choosing them without a review. No implementation readiness is implied by a status command finding all artifact files.

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
