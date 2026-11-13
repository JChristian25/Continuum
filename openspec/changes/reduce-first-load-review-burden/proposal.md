## Why

New users cannot readily see how capture and initial review lead to revision comparison and incoming revalidation. Requiring an explanation for every ordinary initial judgment adds interaction without changing its exact evidence or authority checks.

## What Changes

- Add persistent Workspace progress derived from captured snapshots, operations, coverage, completion records and comparisons, without simulated percentages.
- Permit absent reasons for ordinary initial candidate confirmation/rejection; retain supplied reasons and all accountability metadata.
- Make history, search and JSON export absence-safe, with an explicit absence presentation.
- Preserve exceptional-action reasons, evidence acknowledgment, drafts, retries and read-only contexts.
- Defer batch review to a separate proposal.

## Capabilities

### New Capabilities
- `workspace-progress`: actual lifecycle state and available next actions.
- `initial-review-rationale`: bounded optional reasons across writes and retained reads.

### Modified Capabilities
None. These additions complement observed WEB-02/WEB-03/WEB-04. The prior change's proposed relationship-review C-05a requires a nonblank reason; this proposal explicitly supersedes that rule only for ordinary initial candidate judgments if implemented. Do not edit the earlier evidence or merge this proposal into current specs yet.

## Impact

Affected areas: ServiceApp, serviceModel, ServiceContinuumProvider, schemas/review/models/access/cycle and workspace projections; API documentation and focused tests. No new dependency is proposed. C-04a, C-05a, retained-history and revision-revalidation requirements remain traceability references. Healthchecks scope and frozen profile remain unchanged; no extension becomes core.

Planning does not authorize implementation. No source acquisition, service startup, database migration/reset or deployment is included. PRODUCT.md and DESIGN.md remain preserved. Manuscript and storage readiness issues are recorded in design.md. Interaction reduction is a design property; measured burden/adoption claims require practitioner evaluation.
