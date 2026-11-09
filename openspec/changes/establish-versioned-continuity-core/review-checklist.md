# Specification review checklist

Stage: specifications only. This checklist is not an implementation task list. `tasks.md` is intentionally absent while the blocking decisions in design.md remain unresolved. OpenSpec's file-status output and formatting validation do not clear those decisions.

## Completed source reconciliation

- [x] Reconcile committed core, processing and readiness against MS-2026-11-09 and record exact page anchors in specs/manuscript-reconciliation.md.
- [x] Record the user's explicit decision to include plain text in the proposed core without adding other languages or formats.
- [x] Define missing search/graph access, positive discovery, retirement acceptance and release disclosures as proposed requirements.

## Behavior review

- [ ] Review the four capability boundaries against C-01 through C-10 and retain explicit X-01 through X-03 exclusions; verify the traceability table covers each scenario.
- [ ] Specify initial-review versus historical-context command rules with request/response examples; verify an earlier confirmation cannot silently affirm new evidence.
- [ ] Resolve correction, reversal and retirement transitions, including later follow-up notes; verify no scenario erases earlier accountable events.
- [ ] Review incomplete processing, missing source, deleted endpoints and ambiguous moves; verify every unknown outcome remains visible.

## Design prerequisites

- [ ] Record A-STACK with alternatives, compatibility and atomic-write verification requirements; verify no installed backend is assumed.
- [ ] Record A-AUTH with trusted actor/session and per-command repository permission rules; verify unknown/revoked actors fail closed.
- [ ] Complete A-SCHEMA examples for initial review, comparison, judgment, correction, reversal, history, retries and conflicts; verify field/type/error consistency.
- [ ] Record A-LIMITS with explicit values and units for inventory, bytes, candidates, pages and operation duration; verify incomplete-result behavior at each bound.
- [ ] Decide A-DISCOVERY and its exact configuration; verify automatic discovery and manual capture have separate expected results.
- [ ] Define A-INPUT as a future authorized Healthchecks acquisition and immutable revision/inventory manifest; verify no other local folder supplies evidence.

## Readiness review

- [ ] Link each OpenSpec scenario to planned T-/HC- verification and identify test-layer boundaries; verify fixture presentation cannot satisfy a real-repository test.
- [ ] Review UI compatibility against PRODUCT.md and DESIGN.md; verify the proposal does not replace the existing design.
- [ ] Re-run strict OpenSpec validation after accepted edits; verify no unresolved structural issue remains.
- [ ] Obtain approval of a bounded implementation-ready design before authoring its technology-specific tasks.md; verify each future task has observable completion evidence.

Do not apply, synchronize proposed behavior into main specs, or archive this change as implemented during this stage.
