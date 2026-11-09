# Proposal

## Why

Continuum's frontend demonstrates review with synthetic records, but a real continuity cycle needs exact source versions, inspectable relationship evidence and retained human decisions. Define that cycle before selecting or building its backend so the existing UI can later use a consistent contract.

## What Changes

- Specify artifact and evidence identity for one selected Git project, supported Python files, Markdown and plain-text documents, and captured requirement/decision records.
- Specify independent relationship assertions, authorized review with reasons, correction, reversal and historical retrieval.
- Specify selected-revision comparison that requests direct reassessment without silently carrying old confirmations forward.
- Specify search and typed graph inspection of supported current and historical context.
- Define traceable scenarios and future verification tasks. These files are planning artifacts only; this change has no implementation authorization.

## Capabilities

### New Capabilities

- `artifact-context`: supported artifact identities, immutable versions, evidence locations and explicit processing limits.
- `relationship-review`: version-specific candidate judgment, authorization, correction, retained rationale and separate follow-up.
- `revision-revalidation`: selected revision changes, direct candidate impact, stale contexts and retained earlier decisions.
- `knowledge-access`: search, common typed representation, graph inspection and explicit current/historical views.

### Modified Capabilities

None. The existing `frontend-demo` describes the observed synthetic UI and remains unchanged. Service integration and any deliberate change to that demo behavior require a later explicit delta.

## Impact

This proposal will eventually require backend records and commands that do not exist in the frontend. Backend framework, storage, trusted identity and deployment are open. No application dependency or runtime file is changed by this planning step.

Source context: `specs/requirements.md` C-01 through C-10 and HC-01 through HC-08/HC-02D, plus `specs/continuity-contract.md` and `specs/acceptance-plan.md`. The accepted future test-project identity is Healthchecks; exact source acquisition, revisions and inventory remain open. The user explicitly included plain text in the proposed core during the latest-manuscript reconciliation. Candidate discovery is not verified against it.

Out of scope: additional repositories/languages/formats, event connectors, conversational assistance, transitive impact, automated source edits, model training, calibrated confidence, UI replacement and claims of precision, productivity or long-term effectiveness. X-01 through X-03 remain extensions. Preserve PRODUCT.md and DESIGN.md.

## Manuscript reconciliation

This draft was reconciled with MS-2026-11-09 for committed scope, core processing and readiness. See [the reconciliation record](../../../specs/manuscript-reconciliation.md) for exact page/section mappings, decisions and limits. Search/graph access closes an existing C-08 obligation; it does not authorize UI replacement. Plain text was explicitly approved for the proposed core. The new requirements remain proposals, not observed capabilities.
