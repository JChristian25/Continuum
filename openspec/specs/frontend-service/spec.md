# Observed frontend service integration

## Purpose

Record implemented service-backed behavior checked on 2026-11-13. Sources are
`apps/web/src/components/ServiceApp.jsx`, `apps/web/src/context/ServiceContinuumProvider.jsx`,
the service adapter/model tests, `services/api/tests/test_frontend_browser.py`
and `services/api/FRONTEND.md`. This is a bounded local integration; it does not
establish the complete proposed continuity cycle or production deployment.

## Requirements

### Requirement: WEB-01 Explicit service and demonstration modes
The normal frontend SHALL authenticate against the service and SHALL load only
granted repositories and registered inputs. Synthetic mode SHALL require the
explicit `mode=demo` query parameter.

#### Scenario: Old synthetic session and unreachable service
- **WHEN** old demo session storage exists and the normal frontend loads
- **THEN** it requests the server session instead of trusting the demo identity
- **AND** a failed service request does not produce synthetic workspace rows

### Requirement: WEB-02 Exact snapshot review
The service frontend SHALL identify review rows by context and assertion revision
and SHALL read exact source/evidence versions and retained history for that view.

#### Scenario: Inspect a captured relationship
- **WHEN** a user opens a relationship from the current snapshot
- **THEN** its context, projection version, assertion revision, sources, evidence
  and processing limitations are inspectable
- **AND** candidate status is separate from content concerns and follow-up work

#### Scenario: Historical or viewer inspection
- **WHEN** a retained historical snapshot is selected or the actor has viewer access
- **THEN** evidence remains readable and judgment controls are disabled
- **AND** the service independently enforces its write guards

### Requirement: WEB-03 Durable drafts and explicit uncertain retry
The service adapter SHALL retain review drafts under the actor, repository, commit,
context and assertion revision. It SHALL persist the exact write envelope before
dispatch and require explicit retry after uncertain delivery.

#### Scenario: Reload an unsent judgment
- **WHEN** a reviewer edits a judgment, leaves its context and reloads
- **THEN** reopening that exact context restores the unsent draft

#### Scenario: Commit succeeds but its response is lost
- **WHEN** a command commits and the browser loses the response
- **THEN** the browser retains the original request ID and input
- **AND** explicit retry produces the original receipt without another judgment

#### Scenario: Another write invalidates the displayed projection
- **WHEN** a reviewer submits a context after a competing write
- **THEN** the service rejects the stale write
- **AND** the browser preserves the draft for inspection after refresh

### Requirement: WEB-04 Truthful knowledge access
The frontend SHALL use snapshot artifacts and relationships for lists, filtering,
graphs, counts and coverage. Unsupported comparison, completion and export
capabilities SHALL NOT present success controls or synthetic results.

#### Scenario: Browse a captured file
- **WHEN** a user opens a snapshot artifact in Code explorer
- **THEN** its exact captured version and identity are read from the service
- **AND** fixture file contents are not substituted
