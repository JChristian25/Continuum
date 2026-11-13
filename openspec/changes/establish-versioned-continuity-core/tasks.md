# Tasks

Implementation was requested and the stack selected on 2026-11-13. See
implementation.md for the initial file boundary and operating defaults.
Discovery and Healthchecks prerequisites were settled by the separately recorded
input/profile acceptances. Earlier implementation limits below are retained as
stage history; the dated completion entry identifies the verified continuation.

## 1. Persistence and identity

- [x] 1.1 Add the FastAPI/PostgreSQL package, explicit schema initialization and isolated test setup; verify imports, OpenAPI generation and PostgreSQL connectivity (C-05b).
- [x] 1.2 Implement provisioned accounts, opaque expiring sessions, login bootstrap, CSRF, repository grants and revocation; verify unauthenticated, viewer, cross-repository, expired and revoked requests fail (C-05a/d/e/f, AU-01/02/05/06).

## 2. Exact-version relationship review

- [x] 2.1 Add immutable artifact/version/evidence/assertion/context records and exact reads; verify independent assertions and source anchors without consulting other checkouts (C-01a/b, C-03a/b/d).
- [x] 2.2 Implement transactional judgments, retained receipts and expected projection versions; verify retry equality, concurrent conflicts and rollback after persistence failure (C-05a/b/c, T-01/04/06).
- [x] 2.3 Implement correction, reversal, independent follow-up and bounded stable history; verify predecessors, retirement reversal, historical writes and follow-up after reversal (C-07a/b, C-08a, C-10a).
- [x] 2.4 Document service setup, API subset, operating defaults and observed verification; verify documented commands and preserve the existing frontend build/workflow tests.

## 3. Source processing prerequisites and implementation

- [x] 3.1 Settle authorized Healthchecks acquisition, exact revisions, immutable inventory and independent outcomes; verify a reproducible input manifest without reading another checkout (A-INPUT, C-09a).
- [x] 3.2 Settle the versioned discovery/support profile and job limits, then implement capture and independent automatic/manual candidate results; verify incomplete coverage and immutable source provenance (A-DISCOVERY, C-01c, C-02a/b, C-04a/b).
- [x] 3.3 Implement selected-revision comparison and one-hop revalidation; verify deleted endpoints, stale/unconfirmed separation, retained history and retry behavior (C-06a/b, C-07c/d/e).

## 4. Access and integration

- [x] 4.1 Implement retained snapshots, search, graph, completion and export with safe pagination; verify snapshot consistency, access isolation and unsettled-work conflicts (C-03c, C-08b/c/d, C-10b).
- [x] 4.2 Connect the existing frontend through a separately tested service adapter, preserving appearance and context-keyed drafts; verify browser login, uncertain delivery, conflicts, historical reads and service/demo isolation (AU-03, T-17/19/20).
- [x] 4.3 Prepare the reproducible release record and guided task evidence using accepted inputs; report source, PostgreSQL, browser and real-project results separately (C-09a/b, HC-01 through HC-08).

## Workflow follow-up

- Review the complete implementation and evidence before synchronizing observed specs or archiving this change.

Frontend integration evidence and remaining UI form limits are recorded in
`services/api/FRONTEND.md` and `frontend-integration-verification.json`. This does
not mark comparison, complete knowledge access or the research evaluation complete.

Task 3.3 continuation: bounded compare_revisions API and frontend entry are now
implemented; exact captured snapshots, stale/candidate separation, equal commits,
history retention and retry deduplication are tested. Deletion/rename, chaining,
full revalidation and race gates remain open; see implementation.md.

Completion, 2026-11-14: tasks 3.3, 4.1 and 4.3 are verified within the accepted
bounded scope. The 132-test PostgreSQL/backend suite (including the authenticated
browser flow), 11 frontend tests, separate layout/library browser checks, build,
dependency check and strict OpenSpec validation pass. The development release is
`continuity-core-76663ead5b7f9117f99a4654`; see services/api/RELEASE.json and
services/api/CONTINUITY.md. Deletion is a synthetic isolated boundary fixture;
the guided rehearsal is automated development evidence, not practitioner results.
All 12 tracked tasks are complete. Review before spec synchronization/archive;
no archive, deployment or live schema migration was performed.
